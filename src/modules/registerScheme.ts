import { getString } from "../utils/locale";
import { AddonTable } from "../modules/addonTable";
import { AddonInfoManager } from "../modules/addonInfo";
import { Sources, currentSource, setCurrentSource, setCustomSourceApi } from "../utils/configuration";
import { installAddonFrom } from "../utils/utils";


/**
 * register custom scheme in Zotero
 * - for config source from url:
 *   zotero://zoteroaddoncollection/configSource?source=source-custom&customURL={encodeURIComponent(SOME URL)}
 * - for install add-on from url:
 *   zotero://zoteroaddoncollection/install?source={encodeURIComponent(SOME URL)}
 */
export function registerConfigScheme() {
  const ZOTERO_SCHEME = "zotero";
  const ZOTERO_PROTOCOL_CONTRACTID = "@mozilla.org/network/protocol;1?name=" + ZOTERO_SCHEME;
  const customScheme = ZOTERO_SCHEME + "://zoteroaddoncollection"
  const CustomSchemeExtension = {
    noContent: true,
    loadAsChrome: false,

    // eslint-disable-next-line require-yield
    doAction: (Zotero.Promise as any).coroutine(function* (uri: any) {
      let path = uri.pathQueryRef;
      if (!path) {
        ztoolkit.log('invalid scheme URL');
        return 'Invalid URL';
      }
      path = path.substr('//zoteroaddoncollection/'.length);

      const params = {
        action: ""
      };
      const router = new Zotero.Router(params);
      router.add('configSource', () => {
        params.action = "configSource";
      });
      router.add('install', () => {
        params.action = "install";
      });
      router.run(path);
      Zotero.API.parseParams(params);

      if (params.action == "configSource") {
        let success = false;
        if ('source' in params && typeof params.source === 'string' && Sources.find(source => source.id === params.source)) {
          ztoolkit.log(`receive source from scheme ${params.source}`);
          if (params.source === "source-custom") {
            if ('customURL' in params && typeof params.customURL === 'string') {
              const customURL = decodeURIComponent(params.customURL);
              ztoolkit.log(`receive custom url from scheme ${customURL}`);
              setCurrentSource(params.source);
              setCustomSourceApi(customURL);
              success = true;
            } else {
              success = false;
            }
          } else {
            setCurrentSource(params.source);
            if (params.source === "source-auto" && currentSource().id !== "source-auto") {
              (async () => {
                await AddonInfoManager.autoSwitchAvaliableApi();
                AddonTable.refresh(false);
              })();
            }
            success = true;
          }
        }
        if (success) {
          AddonTable.close();
          AddonTable.showAddonsWindow();
          new ztoolkit.ProgressWindow(getString('addon-name'), {
            closeOnClick: true,
            closeTime: 3000,
          }).createLine({
            text: getString('scheme-config-success'),
            type: "success",
          }).show(3000);
        }
      } else if (params.action == "install") {
        if ('source' in params && typeof params.source === "string") {
          const addonURL = decodeURIComponent(params.source);
          (async () => {
            const install = await Services.prompt.confirmEx(
              null,
              getString('scheme-install-confirm-title'),
              getString('scheme-install-confirm-message') + '\n' + addonURL,
              Services.prompt.BUTTON_POS_0 * Services.prompt.BUTTON_TITLE_IS_STRING + Services.prompt.BUTTON_POS_1 * Services.prompt.BUTTON_TITLE_CANCEL,
              getString('scheme-install-confirm-confirm'),
              null,
              null,
              "",
              {}
            );
            if (install === 0) {
              installAddonFrom(addonURL, { popWin: true });
            }
          })();
        }
      }
    }),

    newChannel: function (uri: any) {
      ztoolkit.log(uri);
      this.doAction(uri);
    }
  };
  const zoteroProtocolHandler = Components.classes[ZOTERO_PROTOCOL_CONTRACTID]
    .getService(Components.interfaces.nsISupports)
    .wrappedJSObject

  zoteroProtocolHandler._extensions[customScheme] = CustomSchemeExtension
}