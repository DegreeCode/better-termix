import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  renderWithApp,
  type RenderedPluginApp,
} from "@termix-ssh/plugin-sdk/testing";
import type { PluginManifest } from "@termix-ssh/plugin-sdk/manifest";
import * as plugin from "../../src/frontend/index";
import { BOOT_CACHE_KEY, lookFromSettings } from "../../src/frontend/index";
import manifestJson from "../../manifest.json";
import locales from "../../locales/en.json";

const manifest = manifestJson as unknown as PluginManifest;

let rendered: RenderedPluginApp | null = null;

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = "";
  document.documentElement.removeAttribute("style");
});

afterEach(async () => {
  await rendered?.deactivate();
  rendered = null;
});

describe("lookFromSettings", () => {
  it("hides IPs and colors names by default", () => {
    expect(lookFromSettings({})).toEqual({
      classes: ["bt-hide-ip", "bt-status-color"],
      vars: {
        "--bt-online-color": "#22c55e",
        "--bt-offline-color": "#ef4444",
      },
    });
  });

  it("shows the status as a color, a dot or both", () => {
    expect(lookFromSettings({ statusStyle: "dot" }).classes).toEqual([
      "bt-hide-ip",
      "bt-status-dot",
    ]);
    expect(lookFromSettings({ statusStyle: "both" }).classes).toEqual([
      "bt-hide-ip",
      "bt-status-color",
      "bt-status-dot",
    ]);
    expect(lookFromSettings({ statusStyle: "nonsense" }).classes).toEqual([
      "bt-hide-ip",
      "bt-status-color",
    ]);
  });

  it("turns each feature off on its own", () => {
    expect(lookFromSettings({ hideIp: false, statusNames: false })).toEqual({
      classes: [],
      vars: {},
    });
  });

  it("keeps custom colors and falls back on bad ones", () => {
    const look = lookFromSettings({
      onlineColor: "#00ff00",
      offlineColor: "not a color",
    });
    expect(look.vars["--bt-online-color"]).toBe("#00ff00");
    expect(look.vars["--bt-offline-color"]).toBe("#ef4444");
  });

  it("sets the medium size within Normal and Large", () => {
    expect(
      lookFromSettings({ mediumSize: true, mediumSizePx: 16 }).vars[
        "--bt-font-size"
      ],
    ).toBe("16px");
    expect(
      lookFromSettings({ mediumSize: true, mediumSizePx: 40 }).vars[
        "--bt-font-size"
      ],
    ).toBe("15.5px");
    expect(lookFromSettings({ mediumSize: true }).classes).toContain(
      "bt-medium-size",
    );
  });
});

describe(`${manifest.id} activate`, () => {
  it("mounts the look sync in the shell overlay", async () => {
    rendered = await renderWithApp(plugin, { manifest, locales });
    expect(rendered.registered.slot("shell.overlay")).toHaveLength(1);
  });

  it("applies the cached look at once and removes the boot style", async () => {
    localStorage.setItem(
      BOOT_CACHE_KEY,
      JSON.stringify({
        classes: ["bt-hide-ip", "bt-medium-size"],
        vars: { "--bt-font-size": "15px" },
      }),
    );
    const style = document.createElement("style");
    style.id = "better-termix-boot";
    document.head.appendChild(style);

    rendered = await renderWithApp(plugin, { manifest, locales });
    const root = document.documentElement;
    expect(root.classList.contains("bt-hide-ip")).toBe(true);
    expect(root.classList.contains("bt-medium-size")).toBe(true);
    expect(root.style.getPropertyValue("--bt-font-size")).toBe("15px");
    expect(document.getElementById("better-termix-boot")).toBeNull();
  });

  it("puts <html> back on disable", async () => {
    localStorage.setItem(
      BOOT_CACHE_KEY,
      JSON.stringify({ classes: ["bt-status-dot"], vars: {} }),
    );
    rendered = await renderWithApp(plugin, { manifest, locales });
    await rendered.deactivate();
    rendered = null;
    expect(document.documentElement.className).toBe("");
  });

  it("works again after disable then enable", async () => {
    rendered = await renderWithApp(plugin, { manifest, locales });
    await rendered.deactivate();
    rendered = await renderWithApp(plugin, { manifest, locales });
    expect(rendered.registered.slot("shell.overlay")).toHaveLength(1);
  });
});
