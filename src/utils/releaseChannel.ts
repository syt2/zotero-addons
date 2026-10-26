/**
 * Compatibility behavior for Zotero release and preview builds.
 *
 * Preview builds no longer enforce strict_max_version. On those builds the
 * market treats the current and previous major version indexes as one
 * compatibility catalog. Stable builds keep the strict, single-index behavior.
 */
export interface BuildCompatibilityPolicy {
  isPreviewBuild: boolean;
  enforceMaxVersion: boolean;
  usePreviousMajorFallback: boolean;
}

export interface BuildCompatibilityOptions {
  version: string;
  updateChannel?: string;
  strictCompatibility?: boolean;
}

export function buildCompatibilityPolicy(
  options: BuildCompatibilityOptions,
): BuildCompatibilityPolicy {
  const version = options.version.toLowerCase();
  const updateChannel = options.updateChannel?.toLowerCase() || "release";
  const isPreviewBuild =
    updateChannel !== "release" || /-(beta|dev|source)/.test(version);
  const enforceMaxVersion = options.strictCompatibility !== false;
  return {
    isPreviewBuild,
    enforceMaxVersion,
    usePreviousMajorFallback: isPreviewBuild && !enforceMaxVersion,
  };
}

/**
 * Read the running Zotero build. Kept separate from the pure policy function
 * so tests and callers can provide deterministic build information.
 */
export function currentBuildCompatibilityOptions(): BuildCompatibilityOptions {
  let updateChannel = "release";
  let strictCompatibility = true;
  try {
    updateChannel = Services.prefs.getStringPref(
      "app.update.channel",
      "release",
    );
  } catch {
    // Older or restricted builds may not expose the channel preference.
  }
  try {
    strictCompatibility = Services.prefs.getBoolPref(
      "extensions.strictCompatibility",
      true,
    );
  } catch {
    // Preserve the strict behavior if the preference cannot be read.
  }
  return {
    version: Zotero.version,
    updateChannel,
    strictCompatibility,
  };
}

export function currentBuildCompatibilityPolicy() {
  return buildCompatibilityPolicy(currentBuildCompatibilityOptions());
}
