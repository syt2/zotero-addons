import { config } from "../../package.json";
import { waitUntil } from "./wait";

/**
 * Initialize locale data
 */
export function initLocale() {
  ztoolkit.UI.appendElement(
    {
      tag: "link",
      namespace: "html",
      properties: {
        rel: "localization",
        href: `${config.addonRef}-addon.ftl`,
      },
    },
    document.querySelector("linkset")!
  );
}

/**
 * Get locale string
 * @param localString
 * @deprecated
 */
export function getString(localString: string): string {
  let result = "";
  let flag = false;
  getStringAsync(localString)
    .then((value) => {
      result = value;
      flag = true;
    })
    .catch((e) => {
      ztoolkit.log(e);
      flag = true;
    });
  const t = new Date().getTime();
  while (!flag && t < new Date().getTime() - 3000) {
    // wait until the string is loaded
  }
  return result;
}

/**
 * Get locale string async
 * @param localString
 */
export async function getStringAsync(localString: string): Promise<string> {
  // @ts-ignore
  return (await document.l10n.formatValue(localString)) || localString;
}
