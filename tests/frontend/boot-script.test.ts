import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BOOT_SCRIPT } from "../../src/backend/boot-script";

// The shipped text, run the way a browser runs the file.
const run = () => new Function(BOOT_SCRIPT)();

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = "";
  document.documentElement.removeAttribute("style");
  document.head.innerHTML = "";
});

describe("boot script", () => {
  it("is self-contained", () => {
    expect(BOOT_SCRIPT).not.toMatch(/\b(import|require|__name)\b/);
  });

  it("puts the saved theme and size on <html> before Termix runs", () => {
    localStorage.setItem("vite-ui-theme", "nord");
    localStorage.setItem("termix-font-size", "lg");
    localStorage.setItem("termix-accent", "#3b82f6");
    run();
    const root = document.documentElement;
    expect(root.classList.contains("nord")).toBe(true);
    expect(root.classList.contains("fs-lg")).toBe(true);
    expect(root.style.getPropertyValue("--accent-brand")).toBe("#3b82f6");
  });

  it("defaults to dark like Termix", () => {
    run();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("loads a plugin theme's cached stylesheet with Termix's link id", () => {
    localStorage.setItem("vite-ui-theme", "nord");
    localStorage.setItem(
      "termix-theme-css",
      JSON.stringify({ id: "nord", href: "/plugin-assets/x/nord.css" }),
    );
    const write = vi.spyOn(document, "write").mockImplementation(() => {});
    run();
    expect(write).toHaveBeenCalledWith(
      '<link id="termix-theme-css" rel="stylesheet" href="/plugin-assets/x/nord.css">',
    );
  });

  it("refuses a cached stylesheet href that could break out of the tag", () => {
    localStorage.setItem("vite-ui-theme", "nord");
    localStorage.setItem(
      "termix-theme-css",
      JSON.stringify({ id: "nord", href: '/x.css"><script>' }),
    );
    const write = vi.spyOn(document, "write").mockImplementation(() => {});
    run();
    expect(write).not.toHaveBeenCalled();
  });

  it("applies this plugin's cached classes, variables and background", () => {
    localStorage.setItem(
      "better-termix:boot",
      JSON.stringify({
        classes: ["bt-medium-size", "evil"],
        vars: { "--bt-font-size": "15.5px", "--other": "1" },
        bg: "rgb(9, 9, 11)",
      }),
    );
    run();
    const root = document.documentElement;
    expect(root.classList.contains("bt-medium-size")).toBe(true);
    expect(root.classList.contains("evil")).toBe(false);
    expect(root.style.getPropertyValue("--bt-font-size")).toBe("15.5px");
    expect(root.style.getPropertyValue("--other")).toBe("");
    expect(
      document.getElementById("better-termix-boot")?.textContent,
    ).toContain("html{background-color:rgb(9, 9, 11)}");
  });

  it("refuses a background that could break out of the rule", () => {
    localStorage.setItem(
      "better-termix:boot",
      JSON.stringify({ classes: [], vars: {}, bg: "red}body{display:none" }),
    );
    run();
    expect(
      document.getElementById("better-termix-boot")?.textContent,
    ).not.toContain("display");
  });

  it("survives corrupt storage", () => {
    localStorage.setItem("termix-theme-css", "{");
    localStorage.setItem("better-termix:boot", "nope");
    expect(run).not.toThrow();
  });
});
