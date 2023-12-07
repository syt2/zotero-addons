import { exit } from "process";
import { execSync } from "child_process";
import cmd from "./zotero-cmd.json" assert { type: "json" };

const { zoteroBinPath, profilePath } = cmd.exec;

const startZotero = `"${zoteroBinPath}" --debugger --purgecaches -profile "${profilePath}"`;

const script = `
(async () => {
  Zotero.Prefs.set("devtools.debugger.remote-enabled", true, true);
  Zotero.Prefs.set("devtools.debugger.remote-port", 6100, true);
  Zotero.Prefs.set("devtools.debugger.prompt-connection", false, true);
  Zotero.Prefs.set("devtools.debugger.chrome-debugging-websocket", false, true);
  
  env =
    Services.env ||
    Cc["@mozilla.org/process/environment;1"].getService(Ci.nsIEnvironment);
  
  env.set("MOZ_BROWSER_TOOLBOX_PORT", 6100);
  Zotero.openInViewer(
    "chrome://devtools/content/framework/browser-toolbox/window.html",
    {
      onLoad: (doc) => {
        doc.querySelector("#status-message-container").style.visibility =
          "collapse";
        let toolboxBody;
        waitUntil(
          () => {
            toolboxBody = doc
              .querySelector(".devtools-toolbox-browsertoolbox-iframe")
              ?.contentDocument?.querySelector(".theme-body");
            return toolboxBody;
          },
          () => {
            toolboxBody.style = "pointer-events: all !important";
          }
        );
      },
    }
  );
  
  function waitUntil(condition, callback, interval = 100, timeout = 10000) {
    const start = Date.now();
    const intervalId = setInterval(() => {
      if (condition()) {
        clearInterval(intervalId);
        callback();
      } else if (Date.now() - start > timeout) {
        clearInterval(intervalId);
      }
    }, interval);
  }  
})()`;

const url = `zotero://ztoolkit-debug/?run=${encodeURIComponent(script)}`;

const command = `${startZotero} -url "${url}"`;

execSync(command);
exit(0);
