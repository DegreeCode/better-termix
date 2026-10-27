import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { Terminal } from "@xterm/headless";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockCtx } from "@termix-ssh/plugin-sdk/testing";
import type { PluginManifest } from "@termix-ssh/plugin-sdk/manifest";
import {
  activateTerminalInputPatch,
  defaultTerminalFrontendFiles,
  installTerminalInputPatch,
  patchTerminalInput,
  removeTerminalInputPatch,
  stripTerminalInputPatch,
} from "../../src/backend/terminal-input-patch";
import manifestJson from "../../manifest.json";

const manifest = manifestJson as unknown as PluginManifest;
const BUNDLE = fs.readFileSync(
  fileURLToPath(
    new URL("../fixtures/terminal-local-echo.js.txt", import.meta.url),
  ),
  "utf8",
);

let dir: string;
let file: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "better-termix-terminal-"));
  fs.mkdirSync(path.join(dir, "dist"));
  fs.writeFileSync(
    path.join(dir, "manifest.json"),
    JSON.stringify({ id: "ssh-terminal" }),
  );
  file = path.join(dir, "dist/frontend.js");
  fs.writeFileSync(file, BUNDLE);
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("terminal input patch", () => {
  it("forces every configured echo mode off without changing the original settings", () => {
    const patched = patchTerminalInput(BUNDLE);
    for (const mode of [undefined, "default", "auto", "on", "off"]) {
      expect(
        vm.runInNewContext(
          `${patched}\nresolveLocalEchoMode(${JSON.stringify(mode)})`,
        ),
      ).toBe("off");
    }
    expect(patchTerminalInput(patched)).toBe(patched);
    expect(stripTerminalInputPatch(patched)).toBe(BUNDLE);
  });

  it("does not touch unknown or ambiguous builds", () => {
    for (const source of [
      "// future terminal bundle",
      BUNDLE + BUNDLE,
      BUNDLE.replace('hostMode : "auto"', 'hostMode : "off"'),
    ]) {
      fs.writeFileSync(file, source);
      expect(() => installTerminalInputPatch(file)).toThrow(
        "Unsupported SSH Terminal bundle",
      );
      expect(fs.readFileSync(file, "utf8")).toBe(source);
    }
  });

  it("rejects a frontend owned by another plugin", () => {
    fs.writeFileSync(path.join(dir, "manifest.json"), '{"id":"other"}');
    expect(() => installTerminalInputPatch(file)).toThrow(
      "does not belong to SSH Terminal",
    );
    expect(fs.readFileSync(file, "utf8")).toBe(BUNDLE);
  });

  it("removes only its override after a restart and preserves unrelated changes", () => {
    installTerminalInputPatch(file);
    fs.appendFileSync(file, "\n// another update\n");
    removeTerminalInputPatch(file);
    expect(fs.readFileSync(file, "utf8")).toBe(
      BUNDLE + "\n// another update\n",
    );
    removeTerminalInputPatch(file);
    fs.writeFileSync(file, "// replacement bundle");
    removeTerminalInputPatch(file);
    expect(fs.readFileSync(file, "utf8")).toBe("// replacement bundle");
  });

  it("finds the bundled terminal in a source build", () => {
    expect(defaultTerminalFrontendFiles("/termix")[0]).toBe(
      "/termix/dist/plugins/ssh-terminal/dist/frontend.js",
    );
  });
});

/** Run the upstream echo implementation and real xterm parser together. */
async function editInMiddle(source: string, mode: string) {
  let now = 0;
  const echo = vm.runInNewContext(
    `${source}\nnew TerminalLocalEcho(resolveLocalEchoMode(${JSON.stringify(mode)}), clock)`,
    { clock: () => now },
  ) as {
    handleInput(data: string): string;
    handleOutput(data: string): string;
  };
  // Two slow remote echoes activate upstream's default "auto" prediction.
  for (const char of "xy") {
    echo.handleInput(char);
    now += 150;
    echo.handleOutput(char);
  }
  const terminal = new Terminal({ cols: 80, rows: 4, allowProposedApi: true });
  const write = (text: string) =>
    text
      ? new Promise<void>((resolve) => terminal.write(text, resolve))
      : Promise.resolve();
  try {
    await write("asfew\x1b[3D"); // as|few
    for (const char of "asdf") {
      await write(echo.handleInput(char));
      // Typical readline echo: insert one cell and print the character.
      await write(echo.handleOutput(`\x1b[1@${char}`));
    }
    return {
      text: terminal.buffer.active.getLine(0)?.translateToString(true),
      cursor: terminal.buffer.active.cursorX,
    };
  } finally {
    terminal.dispose();
  }
}

describe("middle-of-line insertion regression", () => {
  it.each(["on", "auto", "default"])(
    "preserves asasdf|few after patching echo mode %s",
    async (mode) => {
      expect(await editInMiddle(BUNDLE, "off")).toEqual({
        text: "asasdffew",
        cursor: 6,
      });
      expect(await editInMiddle(BUNDLE, mode)).not.toEqual({
        text: "asasdffew",
        cursor: 6,
      });
      expect(await editInMiddle(patchTerminalInput(BUNDLE), mode)).toEqual({
        text: "asasdffew",
        cursor: 6,
      });
    },
  );
});

describe("terminal input setting lifecycle", () => {
  const mockContext = (enabled = true) =>
    createMockCtx({
      pluginId: manifest.id,
      manifest,
      capabilities: manifest.capabilities,
      settings: { terminalInputFix: enabled, terminalFrontendFile: file },
    });

  it("is off by default and independent of the boot patch", async () => {
    const mock = mockContext(false);
    await activateTerminalInputPatch(mock.ctx);
    expect(fs.readFileSync(file, "utf8")).toBe(BUNDLE);
    for (const dispose of mock.disposals) await dispose();
  });

  it("installs on startup, restores on disable, and enables again", async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const mock = mockContext();
      await activateTerminalInputPatch(mock.ctx);
      expect(fs.readFileSync(file, "utf8")).toBe(patchTerminalInput(BUNDLE));
      for (const dispose of mock.disposals) await dispose();
      expect(fs.readFileSync(file, "utf8")).toBe(BUNDLE);
    }
  });

  it("follows setting changes and removes the previous file's override when the path changes", async () => {
    const mock = mockContext(false);
    await activateTerminalInputPatch(mock.ctx);
    await mock.ctx.settings.set("terminalInputFix", true);
    await vi.waitFor(() =>
      expect(fs.readFileSync(file, "utf8")).toBe(patchTerminalInput(BUNDLE)),
    );
    const other = path.join(dir, "dist/other-frontend.js");
    fs.writeFileSync(other, BUNDLE);
    await mock.ctx.settings.set("terminalFrontendFile", other);
    await vi.waitFor(() => {
      expect(fs.readFileSync(file, "utf8")).toBe(BUNDLE);
      expect(fs.readFileSync(other, "utf8")).toBe(patchTerminalInput(BUNDLE));
    });
    await mock.ctx.settings.set("terminalInputFix", false);
    await vi.waitFor(() => expect(fs.readFileSync(other, "utf8")).toBe(BUNDLE));
    for (const dispose of mock.disposals) await dispose();
  });

  it("cannot leave a patch behind when disabled during a queued settings read", async () => {
    const mock = mockContext(false);
    await activateTerminalInputPatch(mock.ctx);
    await mock.ctx.settings.set("terminalInputFix", true);
    for (const dispose of mock.disposals) await dispose();
    expect(fs.readFileSync(file, "utf8")).toBe(BUNDLE);
  });

  it("logs an unsupported build and leaves the rest of the plugin working", async () => {
    fs.writeFileSync(file, "// unsupported");
    const mock = mockContext();
    const warn = vi.spyOn(mock.ctx.log, "warn");
    await expect(activateTerminalInputPatch(mock.ctx)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Unsupported SSH Terminal bundle"),
    );
    expect(fs.readFileSync(file, "utf8")).toBe("// unsupported");
    for (const dispose of mock.disposals) await dispose();
  });
});
