import { BasicTool } from "zotero-plugin-toolkit/dist/basic";
import Addon from "./addon";
import { config } from "../package.json";
import { waitUntil } from "./utils/wait";

const basicTool = new BasicTool();

if (!basicTool.getGlobal("Zotero")[config.addonInstance]) {
  if (__env__ === "development") {
    openDevTool();
  }
  defineGlobal("window");
  defineGlobal("document");
  defineGlobal("ZoteroPane");
  defineGlobal("Zotero_Tabs");
  _globalThis.addon = new Addon();
  defineGlobal("ztoolkit", () => {
    return _globalThis.addon.data.ztoolkit;
  });
  Zotero[config.addonInstance] = addon;
}

function defineGlobal(name: Parameters<BasicTool["getGlobal"]>[0]): void;
function defineGlobal(name: string, getter: () => any): void;
function defineGlobal(name: string, getter?: () => any) {
  Object.defineProperty(_globalThis, name, {
    get() {
      return getter ? getter() : basicTool.getGlobal(name);
    },
  });
}

function openDevTool() {
  // const { BrowserToolboxLauncher } = ChromeUtils.import(
  //   "resource://devtools/client/framework/browser-toolbox/Launcher.jsm",
  // );
  // BrowserToolboxLauncher.init();
  // TODO: Use the above code to open the devtool after https://github.com/zotero/zotero/pull/3387
  Zotero.Prefs.set("devtools.debugger.remote-enabled", true, true);
  Zotero.Prefs.set("devtools.debugger.remote-port", 6100, true);
  Zotero.Prefs.set("devtools.debugger.prompt-connection", false, true);
  Zotero.Prefs.set("devtools.debugger.chrome-debugging-websocket", false, true);

  const env =
    Services.env ||
    // @ts-ignore - mozIEnvironment is not in the types
    Cc["@mozilla.org/process/environment;1"].getService(Ci.nsIEnvironment);

  env.set("MOZ_BROWSER_TOOLBOX_PORT", 6100);
  Zotero.openInViewer(
    "chrome://devtools/content/framework/browser-toolbox/window.html",
    {
      // @ts-ignore - onLoad is not in the types
      onLoad: (doc: Document) => {
        (
          doc.querySelector("#status-message-container") as HTMLDivElement
        ).style.visibility = "collapse";
        let toolboxBody: HTMLIFrameElement;
        waitUntil(
          () => {
            toolboxBody = doc
              .querySelector(".devtools-toolbox-browsertoolbox-iframe")
              // @ts-ignore - contentDocument is not in the types
              ?.contentDocument?.querySelector(".theme-body");
            return !!toolboxBody;
          },
          () => {
            toolboxBody.setAttribute("style", "pointer-events: all !important");
          },
        );
      },
    },
  );
}
