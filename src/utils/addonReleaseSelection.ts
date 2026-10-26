import type { AddonInfo } from "../types";

export type ReleaseEligibility = "native" | "previous-major" | "unsupported";

export interface ReleaseSelectionOptions {
  currentVersion: string;
  allowPreviousMajor: boolean;
  allowUnsupported: boolean;
}

export type AddonRelease = NonNullable<AddonInfo["releases"]>[number];

export interface SelectedAddonRelease {
  release: AddonRelease;
  eligibility: ReleaseEligibility;
  compatible: boolean;
}

function parseMajor(version?: string) {
  if (!version) return undefined;
  const major = Number.parseInt(version, 10);
  return Number.isFinite(major) ? major : undefined;
}

function versionFits(
  version: string,
  minVersion?: string,
  maxVersion?: string,
) {
  if (
    minVersion &&
    Services.vc.compare(version, minVersion.replace(/\*/g, "0")) < 0
  ) {
    return false;
  }
  if (
    maxVersion &&
    Services.vc.compare(version, maxVersion.replace(/\*/g, "999")) > 0
  ) {
    return false;
  }
  return true;
}

function releaseFitsTarget(
  release: AddonRelease,
  currentVersion: string,
  targetMajor: number,
  ignoreMaxVersion: boolean,
) {
  if (parseMajor(release.targetZoteroVersion) !== targetMajor) {
    return false;
  }
  return versionFits(
    currentVersion,
    release.minZoteroVersion,
    ignoreMaxVersion ? undefined : release.maxZoteroVersion,
  );
}

function latestRelease(releases: readonly AddonRelease[]) {
  return releases.reduce((latest, release) => {
    const latestTime = new Date(latest.releaseDate ?? "").getTime() || 0;
    const releaseTime = new Date(release.releaseDate ?? "").getTime() || 0;
    return releaseTime > latestTime ? release : latest;
  });
}

function releaseDistanceFromMajor(release: AddonRelease, currentMajor: number) {
  const targetMajor = parseMajor(release.targetZoteroVersion);
  if (targetMajor !== undefined) {
    return Math.abs(targetMajor - currentMajor);
  }
  const minMajor = parseMajor(release.minZoteroVersion?.replace(/\*/g, "0"));
  const maxMajor = parseMajor(release.maxZoteroVersion?.replace(/\*/g, "999"));
  if (minMajor !== undefined && currentMajor < minMajor) {
    return minMajor - currentMajor;
  }
  if (maxMajor !== undefined && currentMajor > maxMajor) {
    return currentMajor - maxMajor;
  }
  return 0;
}

/**
 * Select a release without ever preferring a future Zotero major.
 *
 * Preview builds may use the immediately preceding major when strict maximum
 * version enforcement is disabled. Stable builds and automatic updates use
 * only a native release. Unsupported display falls back to the closest past or
 * current major, never a future major.
 */
export function selectAddonRelease(
  addonInfo: AddonInfo,
  options: ReleaseSelectionOptions,
): SelectedAddonRelease | undefined {
  const currentMajor = parseMajor(options.currentVersion);
  const releases = (addonInfo.releases ?? []).filter(
    (release) => (release.xpiDownloadUrl?.github?.length ?? 0) > 0,
  );
  if (currentMajor === undefined || releases.length === 0) {
    return undefined;
  }

  const nativeReleases = releases.filter((release) =>
    releaseFitsTarget(release, options.currentVersion, currentMajor, false),
  );
  if (nativeReleases.length > 0) {
    return {
      release: latestRelease(nativeReleases),
      eligibility: "native",
      compatible: true,
    };
  }

  if (options.allowPreviousMajor) {
    const previousReleases = releases.filter((release) =>
      releaseFitsTarget(
        release,
        options.currentVersion,
        currentMajor - 1,
        true,
      ),
    );
    if (previousReleases.length > 0) {
      return {
        release: latestRelease(previousReleases),
        eligibility: "previous-major",
        compatible: false,
      };
    }
  }

  if (!options.allowUnsupported) {
    return undefined;
  }

  const fallbackReleases = releases.filter((release) => {
    const targetMajor = parseMajor(release.targetZoteroVersion);
    return targetMajor === undefined || targetMajor <= currentMajor;
  });
  if (fallbackReleases.length === 0) {
    return undefined;
  }
  const closestRelease = fallbackReleases.reduce((closest, release) => {
    const distanceDelta =
      releaseDistanceFromMajor(release, currentMajor) -
      releaseDistanceFromMajor(closest, currentMajor);
    if (distanceDelta !== 0) {
      return distanceDelta < 0 ? release : closest;
    }
    const releaseTime = new Date(release.releaseDate ?? "").getTime() || 0;
    const closestTime = new Date(closest.releaseDate ?? "").getTime() || 0;
    return releaseTime > closestTime ? release : closest;
  });
  return {
    release: closestRelease,
    eligibility: "unsupported",
    compatible: false,
  };
}
