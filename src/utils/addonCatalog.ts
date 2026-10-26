import type { AddonInfo } from "../types";

function releaseIdentity(release: NonNullable<AddonInfo["releases"]>[number]) {
  return [
    release.targetZoteroVersion,
    release.xpiVersion ?? "",
    release.tagName ?? "",
    release.id ?? "",
  ].join(":");
}

/**
 * Merge the current and previous versioned catalogs by repository.
 *
 * The current index is authoritative for add-on metadata and release order.
 * Releases from the previous index are appended, preserving the current
 * release whenever the same target/version/tag is already present. Add-on IDs
 * are deliberately not used alone: the upstream indexes contain collisions
 * across unrelated repositories.
 */
export function mergeAddonCatalogs(
  currentCatalog: readonly AddonInfo[],
  previousCatalog: readonly AddonInfo[],
): AddonInfo[] {
  const merged = new Map<string, AddonInfo>();
  for (const addon of currentCatalog) {
    const key = addon.repo.toLowerCase();
    merged.set(key, { ...addon, releases: [...(addon.releases ?? [])] });
  }

  for (const addon of previousCatalog) {
    const key = addon.repo.toLowerCase();
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, {
        ...addon,
        releases: [...(addon.releases ?? [])],
      });
      continue;
    }

    const releases = existing.releases!;
    const identities = new Set(releases.map(releaseIdentity));
    for (const release of addon.releases ?? []) {
      const identity = releaseIdentity(release);
      if (!identities.has(identity)) {
        identities.add(identity);
        releases.push(release);
      }
    }
  }

  return [...merged.values()];
}
