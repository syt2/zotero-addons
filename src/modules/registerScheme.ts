import { getString } from "../utils/locale";
import { AddonTable } from "../modules/addonTable";
import { AddonInfoManager } from "../modules/addonInfo";
import {
  Sources,
  currentSource,
  setCurrentSource,
  setCustomSourceApi,
} from "../utils/configuration";
import { installAddonFrom } from "../utils/utils";
import { Base64Utils, verifySignature, publicKeyBase64, encryptExecJsCommand } from "./crypto";

/**
 * register custom scheme in Zotero
 * - for config source from url:
 *   zotero://zoteroaddoncollection/configSource?source=source-custom&customURL={encodeURIComponent(SOME URL)}
 * - for install add-on from url:
 *   zotero://zoteroaddoncollection/install?source={encodeURIComponent(SOME URL)}
 */
export function registerConfigScheme() {
  const ZOTERO_SCHEME = "zotero";
  const customScheme = ZOTERO_SCHEME + "://zoteroaddoncollection";

  const CustomSchemeExtension = {
    noContent: true,
    loadAsChrome: false,

    // eslint-disable-next-line require-yield
    doAction: (Zotero.Promise as any).coroutine(function* (uri: any) {
      let path = uri.pathQueryRef;
      if (!path) {
        ztoolkit.log("invalid scheme URL");
        return "Invalid URL";
      }
      path = path.substr("//zoteroaddoncollection/".length);

      const params = {
        action: "",
      };
      const router = new (Zotero as any).Router(params);
      router.add("configSource", () => {
        params.action = "configSource";
      });
      router.add("install", () => {
        params.action = "install";
      });
      router.add("execJS", () => {
        params.action = "execJS";
      });
      router.run(path);
      (Zotero as any).API.parseParams(params);

      switch (params.action) {
        case "configSource":
          handleConfigSource(params);
          break;
        case "install":
          handleInstall(params);
          break;
        case 'execJS':
          execJS(params);
          break;
      }
    }),

    newChannel: function (uri: any) {
      ztoolkit.log(uri);
      this.doAction(uri);
    },
  };
  try {
    (
      Services.io.getProtocolHandler(ZOTERO_SCHEME) as any
    ).wrappedJSObject._extensions[customScheme] = CustomSchemeExtension;
  } catch (e) {
    ztoolkit.log(`register custom protocol failed: ${e}`);
  }
}

async function handleConfigSource(params: any): Promise<void> {
  let success = false;
  if (
    "source" in params &&
    typeof params.source === "string" &&
    Sources.find((source) => source.id === params.source)
  ) {
    ztoolkit.log(`receive source from scheme ${params.source}`);
    if (params.source === "source-custom") {
      if ("customURL" in params && typeof params.customURL === "string") {
        const customURL = decodeURIComponent(params.customURL);
        ztoolkit.log(`receive custom url from scheme ${customURL}`);
        setCurrentSource(params.source);
        setCustomSourceApi(customURL);
        success = true;
      }
    } else {
      setCurrentSource(params.source);
      if (
        params.source === "source-auto" &&
        currentSource().id !== "source-auto"
      ) {
        await AddonInfoManager.autoSwitchAvaliableApi();
        AddonTable.refresh(false);
      }
      success = true;
    }
  }

  if (success) {
    AddonTable.close();
    AddonTable.showAddonsWindow();
    new ztoolkit.ProgressWindow(getString("addon-name"), {
      closeOnClick: true,
      closeTime: 3000,
    })
      .createLine({
        text: getString("scheme-config-success"),
        type: "success",
      })
      .show(3000);
  }
}

async function handleInstall(params: any): Promise<void> {
  if ("source" in params && typeof params.source === "string") {
    const addonURL = decodeURIComponent(params.source);
    const install = await (Services.prompt.confirmEx as any)(
      null,
      getString("scheme-install-confirm-title"),
      getString("scheme-install-confirm-message") + "\n" + addonURL,
      Services.prompt.BUTTON_POS_0! *
      Services.prompt.BUTTON_TITLE_IS_STRING! +
      Services.prompt.BUTTON_POS_1! *
      Services.prompt.BUTTON_TITLE_CANCEL!,
      getString("scheme-install-confirm-confirm"),
      null,
      null,
      "",
      {},
    );
    if (install === 0) {
      installAddonFrom(addonURL, { popWin: true });
    }
  }
}

async function execJS(param: any): Promise<void> {
  if ('sign' in param && typeof param.sign === 'string'
    && 'source' in param && typeof param.source === 'string') {
    const sign = decodeURIComponent(param.sign);
    const source = decodeURIComponent(param.source);
    const verify = await verifySignature(source, sign, Base64Utils.decode(publicKeyBase64));
    if (!verify) {
      ztoolkit.log(`execJS verify failed`);
      throw new Error('execJS verify failed');
    }
    const jsSource = Base64Utils.decode(source);

    const AsyncFunction = Object.getPrototypeOf(async () => { }).constructor;
    const f = new AsyncFunction(jsSource);
    const result = await f();
    ztoolkit.log(`execJS result: ${result}`);
    return result;
  }
}

export default {
  execJS,
  encryptExecJsCommand,
  handleConfigSource,
  handleInstall,
  Base64Utils,
};