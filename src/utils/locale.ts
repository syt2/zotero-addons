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
 * Get locale string, see https://firefox-source-docs.mozilla.org/l10n/fluent/tutorial.html#fluent-translation-list-ftl
 * @param localString ftl key
 * @param options.branch branch name
 * @param options.args args
 * @example
 * ```ftl
 * # addon.ftl
 * addon-static-example = This is default branch!
 *     .branch-example = This is a branch under addon-static-example!
 * addon-dynamic-example =
    { $count ->
        [one] I have { $count } apple
       *[other] I have { $count } apples
    }
 * ```
 * ```js
 * getString("addon-static-example"); // This is default branch!
 * getString("addon-static-example", { branch: "branch-example" }); // This is a branch under addon-static-example!
 * getString("addon-dynamic-example", { args: { count: 1 } }); // I have 1 apple
 * getString("addon-dynamic-example", { args: { count: 2 } }); // I have 2 apples
 * ```
 */
export function getString(
  localString: string,
  options: { branch?: string | undefined; args?: Record<string, unknown> } = {}
): string {
  const { branch, args } = options;
  const pattern = addon.data.locale?.current.formatMessagesSync([
    { id: localString, args },
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
