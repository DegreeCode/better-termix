import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMockCtx } from "@termix-ssh/plugin-sdk/testing";
import type { PluginManifest } from "@termix-ssh/plugin-sdk/manifest";
import { activate } from "../../src/backend/index";
import {
  BOOT_FILE,
  addBootTag,
  installBootPatch,
  removeBootPatch,
  stripBootTag,
} from "../../src/backend/index-patch";
import { BOOT_SCRIPT } from "../../src/backend/boot-script";
import manifestJson from "../../manifest.json";

const manifest = manifestJson as unknown as PluginManifest;

const INDEX = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Termix</title>
    <script type="module" crossorigin src="./assets/index-abc.js"></script>
    <link rel="stylesheet" crossorigin href="./assets/index-abc.css">
  </head>
  <body><div id="root"></div></body>
</html>
`;

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "better-termix-"));
  fs.writeFileSync(path.join(dir, "index.html"), INDEX);
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("addBootTag", () => {
  it("puts the script last in <head>, after Termix's stylesheet", () => {
    const html = addBootTag(INDEX, "v1");
    const tag = html.indexOf(`src="./${BOOT_FILE}?v=v1"`);
    expect(tag).toBeGreaterThan(html.indexOf("assets/index-abc.css"));
    expect(tag).toBeLessThan(html.indexOf("</head>"));
  });

  it("uses the asset prefix of a base path build", () => {
    const html = addBootTag(
      INDEX.replaceAll("./assets/", "/termix/assets/"),
      "v1",
    );
    expect(html).toContain(`src="/termix/${BOOT_FILE}?v=v1"`);
  });

  it("replaces its own tag instead of adding a second", () => {
    const twice = addBootTag(addBootTag(INDEX, "v1"), "v2");
    expect(twice.match(/<!-- better-termix:boot -->/g)).toHaveLength(1);
    expect(twice).toContain("?v=v2");
    expect(stripBootTag(twice)).toBe(INDEX);
  });
});

describe("installBootPatch / removeBootPatch", () => {
  it("writes the script and restores index.html exactly", () => {
    installBootPatch(dir);
    expect(fs.readFileSync(path.join(dir, BOOT_FILE), "utf8")).toBe(
      BOOT_SCRIPT,
    );
    expect(fs.readFileSync(path.join(dir, "index.html"), "utf8")).toContain(
      BOOT_FILE,
    );
    removeBootPatch(dir);
    expect(fs.existsSync(path.join(dir, BOOT_FILE))).toBe(false);
    expect(fs.readFileSync(path.join(dir, "index.html"), "utf8")).toBe(INDEX);
  });
});

describe("backend activate", () => {
  const index = () => fs.readFileSync(path.join(dir, "index.html"), "utf8");

  it("leaves index.html alone while the setting is off", async () => {
    const mock = createMockCtx({
      pluginId: manifest.id,
      manifest,
      capabilities: manifest.capabilities,
      settings: { bootPatch: false, bootPatchDir: dir },
    });
    await activate(mock.ctx);
    expect(index()).toBe(INDEX);
  });

  it("patches when on and undoes it on disable", async () => {
    const mock = createMockCtx({
      pluginId: manifest.id,
      manifest,
      capabilities: manifest.capabilities,
      settings: { bootPatch: true, bootPatchDir: dir },
    });
    await activate(mock.ctx);
    expect(index()).toContain(BOOT_FILE);
    for (const dispose of mock.disposals) await dispose();
    expect(index()).toBe(INDEX);
  });

  it("does not throw when the folder has no index.html", async () => {
    const mock = createMockCtx({
      pluginId: manifest.id,
      manifest,
      capabilities: manifest.capabilities,
      settings: { bootPatch: true, bootPatchDir: path.join(dir, "missing") },
    });
    await expect(activate(mock.ctx)).resolves.toBeUndefined();
  });
});
