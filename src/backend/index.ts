import type { PluginContext } from "@termix-ssh/plugin-sdk/backend";
import {
  defaultFrontendDirs,
  findFrontendDir,
  installBootPatch,
  removeBootPatch,
} from "./index-patch.js";

export async function activate(ctx: PluginContext) {
  // The folder patched last, so turning the setting off cleans the right one.
  let patched: string | null = null;

  const unpatch = () => {
    if (!patched) return;
    try {
      removeBootPatch(patched);
      ctx.log.info(`Removed the boot script from ${patched}`);
    } catch (error) {
      ctx.log.warn(`Could not remove the boot script: ${String(error)}`);
    }
    patched = null;
  };

  const sync = async () => {
    const enabled = (await ctx.settings.get<boolean>("bootPatch")) === true;
    const custom = ((await ctx.settings.get<string>("bootPatchDir")) ?? "")
      .toString()
      .trim();
    if (!enabled) {
      unpatch();
      return;
    }
    const dir = findFrontendDir(custom ? [custom] : defaultFrontendDirs());
    if (!dir) {
      ctx.log.warn(
        "Could not find Termix's index.html; set the frontend folder in this plugin's settings",
      );
      return;
    }
    if (patched && patched !== dir) unpatch();
    try {
      installBootPatch(dir);
      patched = dir;
      ctx.log.info(`Boot script installed in ${dir}`);
    } catch (error) {
      ctx.log.warn(`Could not install the boot script: ${String(error)}`);
    }
  };

  // Settings errors are logged, never thrown: the rest of the plugin is CSS
  // and keeps working without the patch.
  const resync = () => {
    sync().catch((error) =>
      ctx.log.warn(`Boot script sync failed: ${String(error)}`),
    );
  };

  // At startup too: a new Termix image ships a fresh index.html.
  await sync().catch((error) =>
    ctx.log.warn(`Boot script sync failed: ${String(error)}`),
  );
  ctx.disposables.add(ctx.settings.onChange("bootPatch", resync));
  ctx.disposables.add(ctx.settings.onChange("bootPatchDir", resync));
  ctx.disposables.add(unpatch);
}

export async function deactivate() {
  // The patch is removed by the disposable registered in activate.
}
