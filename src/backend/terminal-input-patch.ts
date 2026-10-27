import fs from "node:fs";
import path from "node:path";
import type { PluginContext } from "@termix-ssh/plugin-sdk/backend";

// Keep the original return statement in place so removal restores the exact
// bytes, even after a restart, without restoring an outdated bundle backup.
const OVERRIDE =
  '/* better-termix:terminal-input */ return "off"; /* /better-termix:terminal-input */';

/** Only recognize the SDK's unminified resolver with its known semantics. */
const RESOLVER =
  /function resolveLocalEchoMode\d*\(\s*([A-Za-z_$][\w$]*)\s*\)\s*\{(\s*)return \1 && \1 !== "default" \? \1 : "auto";\s*\}/g;

export function stripTerminalInputPatch(source: string): string {
  return source.split(OVERRIDE).join("");
}

export function patchTerminalInput(source: string): string {
  const clean = stripTerminalInputPatch(source);
  const matches = [...clean.matchAll(RESOLVER)];
  if (matches.length !== 1) {
    throw new Error(
      "Unsupported SSH Terminal bundle: expected one known local echo resolver; no file was changed",
    );
  }
  const match = matches[0];
  const start = match.index + match[0].indexOf("{") + 1;
  return clean.slice(0, start) + OVERRIDE + clean.slice(start);
}

export function defaultTerminalFrontendFiles(cwd = process.cwd()): string[] {
  return [
    path.join(cwd, "dist/plugins/ssh-terminal/dist/frontend.js"),
    "/app/dist/plugins/ssh-terminal/dist/frontend.js",
  ];
}

function writeAtomic(file: string, content: string): void {
  const tmp = `${file}.better-termix.tmp`;
  try {
    fs.writeFileSync(tmp, content, { mode: fs.statSync(file).mode });
    fs.renameSync(tmp, file);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

export function installTerminalInputPatch(file: string): void {
  // A custom path must still belong to SSH Terminal, not an arbitrary script.
  const manifest = JSON.parse(
    fs.readFileSync(
      path.resolve(path.dirname(file), "../manifest.json"),
      "utf8",
    ),
  ) as { id?: string };
  if (manifest.id !== "ssh-terminal") {
    throw new Error(
      "The selected frontend file does not belong to SSH Terminal",
    );
  }
  const source = fs.readFileSync(file, "utf8");
  const patched = patchTerminalInput(source);
  if (patched !== source) writeAtomic(file, patched);
}

export function removeTerminalInputPatch(file: string): void {
  if (!fs.existsSync(file)) return;
  const source = fs.readFileSync(file, "utf8");
  const clean = stripTerminalInputPatch(source);
  if (clean !== source) writeAtomic(file, clean);
}

/** Serializes settings changes so an earlier enable cannot undo a disable. */
export async function activateTerminalInputPatch(
  ctx: PluginContext,
): Promise<void> {
  let patched: string | null = null;
  let disposed = false;
  let pending = Promise.resolve();

  const unpatch = () => {
    if (patched) {
      removeTerminalInputPatch(patched);
      patched = null;
    }
  };

  const sync = async () => {
    const enabled =
      (await ctx.settings.get<boolean>("terminalInputFix")) === true;
    const custom = await ctx.settings.get<string>("terminalFrontendFile");
    if (disposed) return;
    if (!enabled) {
      unpatch();
      return;
    }
    const candidates = custom?.trim()
      ? [custom.trim()]
      : defaultTerminalFrontendFiles();
    const file = candidates.find((candidate) => fs.existsSync(candidate));
    if (!file) {
      throw new Error(
        "Could not find SSH Terminal's frontend.js; set the SSH Terminal frontend file in Better Termix settings",
      );
    }
    if (patched && patched !== file) unpatch();
    installTerminalInputPatch(file);
    patched = file;
    ctx.log.info(
      `Terminal input fix installed in ${file}; reload and reconnect terminals to apply`,
    );
  };

  const resync = () => {
    pending = pending.then(sync).catch((error) => {
      ctx.log.warn(`Terminal input fix: ${String(error)}`);
    });
    return pending;
  };

  ctx.disposables.add(ctx.settings.onChange("terminalInputFix", resync));
  ctx.disposables.add(ctx.settings.onChange("terminalFrontendFile", resync));
  ctx.disposables.add(async () => {
    disposed = true;
    await pending;
    try {
      unpatch();
    } catch (error) {
      ctx.log.warn(`Could not remove the terminal input fix: ${String(error)}`);
    }
  });
  await resync();
}
