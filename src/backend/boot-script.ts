/**
 * Runs from <head> before Termix's own CSS and JS, so the first paint already
 * has the user's theme. It only repeats, earlier, what Termix and this
 * plugin's frontend do after load, reading the same localStorage keys:
 *
 * - vite-ui-theme / termix-theme-css: the theme class and its plugin stylesheet
 * - termix-font-size / termix-accent: interface size and accent color
 * - better-termix:boot: this plugin's classes, variables and last background
 *
 * Written as a plain function so it is readable and testable; it is shipped as
 * its source text. Keep it to ES2015 that every browser runs as is.
 */
export function boot(): void {
  try {
    const root = document.documentElement;
    const store = window.localStorage;
    const readJson = (key: string): Record<string, unknown> | null => {
      try {
        const value = JSON.parse(store.getItem(key) || "null");
        return value && typeof value === "object" ? value : null;
      } catch {
        return null;
      }
    };

    let theme = store.getItem("vite-ui-theme") || "dark";
    if (theme === "system") {
      theme =
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    }
    if (/^[a-z][a-z0-9-]{0,39}$/.test(theme)) root.classList.add(theme);

    // Termix loads this same stylesheet after its JS runs and reuses the link
    // by id, in place. This script sits after Termix's own stylesheet, so the
    // link lands after it too and the theme wins the cascade. document.write
    // makes it parser-inserted: render blocking in every browser.
    const themeCss = readJson("termix-theme-css");
    if (
      themeCss &&
      themeCss.id === theme &&
      typeof themeCss.href === "string" &&
      /^[\w./?=&%:-]+$/.test(themeCss.href) &&
      !document.getElementById("termix-theme-css")
    ) {
      document.write(
        `<link id="termix-theme-css" rel="stylesheet" href="${themeCss.href}">`,
      );
    }

    const size = store.getItem("termix-font-size");
    if (size && /^(xs|sm|md|lg|xl)$/.test(size))
      root.classList.add(`fs-${size}`);
    const accent = store.getItem("termix-accent");
    if (accent && /^#[0-9a-fA-F]{3,8}$/.test(accent)) {
      root.style.setProperty("--accent-brand", accent);
    }

    const rules = [
      "html.bt-medium-size{font-size:var(--bt-font-size,15.5px)!important}",
    ];
    const cache = readJson("better-termix:boot");
    if (cache) {
      const classes = Array.isArray(cache.classes) ? cache.classes : [];
      for (const name of classes) {
        if (typeof name === "string" && /^bt-[a-z-]+$/.test(name)) {
          root.classList.add(name);
        }
      }
      const vars =
        cache.vars && typeof cache.vars === "object"
          ? (cache.vars as Record<string, unknown>)
          : {};
      for (const name of Object.keys(vars)) {
        const value = vars[name];
        if (
          /^--bt-[a-z-]+$/.test(name) &&
          typeof value === "string" &&
          /^[#(),.%\w\s-]+$/.test(value)
        ) {
          root.style.setProperty(name, value);
        }
      }
      // Only <html>: once Termix's CSS is in, <body> paints over it.
      if (typeof cache.bg === "string" && /^[#(),.%\w\s-]+$/.test(cache.bg)) {
        rules.push(`html{background-color:${cache.bg}}`);
      }
    }

    const style = document.createElement("style");
    style.id = "better-termix-boot";
    style.textContent = rules.join("");
    document.head.appendChild(style);
  } catch {
    // Never stop Termix from loading.
  }
}

export const BOOT_SCRIPT = `(${boot.toString()})();\n`;
