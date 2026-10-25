import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { BOOT_SCRIPT } from "./boot-script.js";

export const BOOT_FILE = "better-termix-boot.js";
const START = "<!-- better-termix:boot -->";
const END = "<!-- /better-termix:boot -->";
const BLOCK = new RegExp(`\\s*${START}[\\s\\S]*?${END}`, "g");

/** Where Termix's built frontend lives: Docker first, then a source checkout. */
export function defaultFrontendDirs(cwd = process.cwd()): string[] {
  return ["/app/html", path.join(cwd, "dist"), path.join(cwd, "html")];
}

export function findFrontendDir(dirs: string[]): string | null {
  return (
    dirs.find((dir) => fs.existsSync(path.join(dir, "index.html"))) ?? null
  );
}

/**
 * The same prefix index.html uses for its own assets ("./" from Vite's
 * default base), so the boot script resolves wherever Termix is served.
 */
function assetPrefix(html: string): string {
  const match = /(?:src|href)=["']([^"']*?)assets\//.exec(html);
  return match ? match[1] : "./";
}

export function stripBootTag(html: string): string {
  return html.replace(BLOCK, "");
}

export function addBootTag(html: string, version: string): string {
  const clean = stripBootTag(html);
  // A classic, synchronous script: it must run before the first paint.
  const tag = `${START}<script src="${assetPrefix(clean)}${BOOT_FILE}?v=${version}"></script>${END}`;
  // Last in <head>, after Termix's own stylesheet: the theme stylesheet the
  // script writes must come after it, or core's :root defaults win the tie.
  const end = /\s*<\/head>/i.exec(clean);
  if (!end) throw new Error("index.html has no </head>");
  return `${clean.slice(0, end.index)}\n    ${tag}${clean.slice(end.index)}`;
}

function writeAtomic(file: string, content: string): void {
  const tmp = `${file}.better-termix.tmp`;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, file);
}

/** Adds the boot script to dir. Safe to run again: it replaces its own tag. */
export function installBootPatch(dir: string): void {
  const indexFile = path.join(dir, "index.html");
  const version = createHash("sha256")
    .update(BOOT_SCRIPT)
    .digest("hex")
    .slice(0, 12);
  writeAtomic(path.join(dir, BOOT_FILE), BOOT_SCRIPT);
  const html = fs.readFileSync(indexFile, "utf8");
  const next = addBootTag(html, version);
  if (next !== html) writeAtomic(indexFile, next);
}

/** Puts index.html back the way Termix shipped it. */
export function removeBootPatch(dir: string): void {
  const indexFile = path.join(dir, "index.html");
  if (fs.existsSync(indexFile)) {
    const html = fs.readFileSync(indexFile, "utf8");
    const next = stripBootTag(html);
    if (next !== html) writeAtomic(indexFile, next);
  }
  fs.rmSync(path.join(dir, BOOT_FILE), { force: true });
}
