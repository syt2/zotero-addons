import { config } from "../../package.json";

/**
 * Initialize locale data
 */
export function initLocale() {
  const l10n = new (ztoolkit.getGlobal("Localization"))(
    [`${config.addonRef}-addon.ftl`],
    true
  );
  addon.data.locale = {
    current: l10n,
  };
}

/**
 * Get locale string
 * @param localString
 * @param branch branch name
 * @example
 * ```ftl
 * # addon.ftl
 * addon-name = Addon Template
 *     .label = Addon Template Label
 * ```
 * ```js
 * getString("addon-name"); // Addon Template
 * getString("addon-name", "label"); // Addon Template Label
 * ```
 */
export function getString(localString: string, branch = ""): string {
  const pattern = addon.data.locale?.current.formatMessagesSync([
    { id: localString },
  ])[0];
  if (!pattern) {
    return localString;
  }
  if (branch && pattern.attributes) {
    return pattern.attributes[branch] || localString;
  } else {
    return pattern.value || localString;
  }
}
