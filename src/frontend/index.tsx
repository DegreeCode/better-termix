import { useEffect } from "react";
import {
  useHostStatus,
  useSettings,
  type PluginHostRecord,
  type TermixApp,
} from "@termix-ssh/plugin-sdk/frontend";
import "./better-termix.css";

/** Read by better-termix-boot.js before the app loads. Keep the shape stable. */
export const BOOT_CACHE_KEY = "better-termix:boot";
/** The <style> better-termix-boot.js writes; this plugin's CSS takes over from it. */
const BOOT_STYLE_ID = "better-termix-boot";

const CLASSES = {
  hideIp: "bt-hide-ip",
  statusColor: "bt-status-color",
  statusDot: "bt-status-dot",
  mediumSize: "bt-medium-size",
} as const;

const VARS = {
  onlineColor: "--bt-online-color",
  offlineColor: "--bt-offline-color",
  fontSize: "--bt-font-size",
} as const;

const DEFAULTS = {
  hideIp: true,
  statusNames: true,
  statusStyle: "name" as StatusStyle,
  onlineColor: "#22c55e",
  offlineColor: "#ef4444",
  mediumSize: false,
  mediumSizePx: 15.5,
};

const STATUS_STYLES = ["name", "dot", "both"] as const;
type StatusStyle = (typeof STATUS_STYLES)[number];

export interface Look {
  classes: string[];
  vars: Record<string, string>;
}

export interface BootCache extends Look {
  /** The page background of the theme last shown, for the moment before CSS. */
  bg?: string;
}

function isColor(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  if (typeof CSS === "undefined" || typeof CSS.supports !== "function") {
    return /^#[0-9a-f]{3,8}$/i.test(value.trim());
  }
  return CSS.supports("color", value.trim());
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/** The classes and variables on <html> that the user's settings ask for. */
export function lookFromSettings(values: Record<string, unknown>): Look {
  const classes: string[] = [];
  const vars: Record<string, string> = {};

  if (bool(values.hideIp, DEFAULTS.hideIp)) classes.push(CLASSES.hideIp);

  // statusNames keeps its key from 1.0 so saved choices carry over.
  if (bool(values.statusNames, DEFAULTS.statusNames)) {
    const style = STATUS_STYLES.includes(values.statusStyle as StatusStyle)
      ? (values.statusStyle as StatusStyle)
      : DEFAULTS.statusStyle;
    if (style !== "dot") classes.push(CLASSES.statusColor);
    if (style !== "name") classes.push(CLASSES.statusDot);
    vars[VARS.onlineColor] = isColor(values.onlineColor)
      ? values.onlineColor.trim()
      : DEFAULTS.onlineColor;
    vars[VARS.offlineColor] = isColor(values.offlineColor)
      ? values.offlineColor.trim()
      : DEFAULTS.offlineColor;
  }

  if (bool(values.mediumSize, DEFAULTS.mediumSize)) {
    const raw = Number(values.mediumSizePx);
    const px =
      Number.isFinite(raw) && raw >= 14 && raw <= 17
        ? raw
        : DEFAULTS.mediumSizePx;
    classes.push(CLASSES.mediumSize);
    vars[VARS.fontSize] = `${px}px`;
  }

  return { classes, vars };
}

function readBootCache(): BootCache | null {
  try {
    const raw = localStorage.getItem(BOOT_CACHE_KEY);
    const parsed = raw ? (JSON.parse(raw) as BootCache) : null;
    return parsed && Array.isArray(parsed.classes) ? parsed : null;
  } catch {
    return null;
  }
}

function writeBootCache(patch: Partial<BootCache>): void {
  try {
    const next = { classes: [], vars: {}, ...readBootCache(), ...patch };
    localStorage.setItem(BOOT_CACHE_KEY, JSON.stringify(next));
  } catch {
    // Private mode: the look still applies, only the early boot misses it.
  }
}

function applyLook(look: Look): void {
  const root = document.documentElement;
  for (const name of Object.values(CLASSES)) {
    root.classList.toggle(name, look.classes.includes(name));
  }
  for (const name of Object.values(VARS)) {
    const value = look.vars[name];
    if (value) root.style.setProperty(name, value);
    else root.style.removeProperty(name);
  }
}

function clearLook(): void {
  applyLook({ classes: [], vars: {} });
}

/** Remembers the theme's background so the next reload paints it first. */
function rememberBackground(): void {
  const bg = getComputedStyle(document.body).backgroundColor;
  // Transparent means the theme has not painted yet; keep the last one.
  if (!bg || bg === "transparent" || bg === "rgba(0, 0, 0, 0)") return;
  writeBootCache({ bg });
}

/** Mounted once in the shell; keeps <html> in step with the user's settings. */
function LookSync() {
  const { values, loaded } = useSettings("user");

  useEffect(() => {
    if (!loaded) return;
    const look = lookFromSettings(values);
    applyLook(look);
    writeBootCache(look);
  }, [loaded, values]);

  return null;
}

/**
 * An invisible badge in each sidebar host row carrying the host's status, so
 * the CSS can color the name even when the row has no status stripe (the
 * Simple preset hides stripes).
 */
export function StatusMarker({ host }: { host: PluginHostRecord }) {
  const info = useHostStatus(Number(host.id));
  const status =
    info?.status === "online" || info?.status === "reachable"
      ? "online"
      : info?.status === "offline"
        ? "offline"
        : "unknown";
  return <span hidden data-bt-status={status} />;
}

export function activate(app: TermixApp): void {
  // Show the last known look at once instead of waiting for settings.
  const cached = readBootCache();
  if (cached) applyLook(cached);
  document.getElementById(BOOT_STYLE_ID)?.remove();

  app.registerSlotContribution("shell.overlay", {
    actionId: "better-termix.look-sync",
    titleKey: "plugin.name",
    kind: "component",
    component: LookSync,
  });

  app.registerHostBadge({
    id: "better-termix-status",
    when: (host) => host.statusCheckEnabled !== false,
    component: StatusMarker,
    order: 10_000,
  });

  // Theme switches change <html>'s class; record the new background after it paints.
  let frame = 0;
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(rememberBackground);
    });
  };
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  schedule();

  app.onDispose(() => {
    observer.disconnect();
    cancelAnimationFrame(frame);
    clearLook();
  });
}
