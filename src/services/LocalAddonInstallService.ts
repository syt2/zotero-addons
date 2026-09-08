import { getAddonManager } from "../utils/compat";

export class LocalAddonInstallError extends Error {
  constructor(public readonly reason: "invalid" | "incompatible") {
    super(reason);
    this.name = "LocalAddonInstallError";
  }
}

/** Install a local package without depending on a window or notification UI. */
export async function installLocalAddon(
  path: string,
  isActive: () => boolean,
): Promise<boolean> {
  if (!isActive()) return false;
  const file = Zotero.File.pathToFile(path);
  if (!file.isFile()) throw new LocalAddonInstallError("invalid");
  const manager = getAddonManager();
  const install = await manager.getInstallForFile(file);

  // getInstallForFile is asynchronous. Unloading the owner while it reads the
  // manifest must not start a new installation when that read completes.
  if (!isActive()) {
    if (install && !install.error) install.cancel();
    return false;
  }
  if (!install || install.error || !install.addon) {
    if (install && !install.error) install.cancel();
    throw new LocalAddonInstallError("invalid");
  }
  if (install.addon.appDisabled) {
    install.cancel();
    throw new LocalAddonInstallError("incompatible");
  }

  // Once installation has started, AddonManager owns its completion. Do not
  // cancel an in-progress replacement on shutdown (including self-updates).
  await install.install();
  return true;
}
