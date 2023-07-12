import { execSync } from "child_process";
import { exit } from "process";
import { existsSync, writeFileSync, readFileSync } from "fs";
import { join, resolve } from "path";
import details from "../package.json" assert { type: "json" };
import cmd from "./zotero-cmd.json" assert { type: "json" };

const { addonID } = details.config;
const { zoteroBinPath, profilePath, dataDir } = cmd.exec;

if (!existsSync(zoteroBinPath)) {
  throw new Error("Zotero bin do no exist.");
}

if (existsSync(profilePath)) {
  const addonProxyFilePath = join(profilePath, `extensions/${addonID}`);
  const buildPath = resolve("build/addon");

  function writeAddonProxyFile() {
    writeFileSync(addonProxyFilePath, buildPath);
    console.log(
      `[info] Addon proxy file has been updated. \n
      File path: ${addonProxyFilePath} \n
      Addon path: ${buildPath} \n`
    );
  }

  if (existsSync(addonProxyFilePath)) {
    if (readFileSync(addonProxyFilePath, "utf-8") !== buildPath) {
      writeAddonProxyFile();
    }
  } else {
    writeAddonProxyFile();
  }

  const prefsPath = join(profilePath, "prefs.js");
  if (existsSync(prefsPath)) {
    const PrefsLines = readFileSync(prefsPath, "utf-8").split("\n");
    const filteredLines = PrefsLines.map((line) => {
      if (
        line.includes("extensions.lastAppBuildId") ||
        line.includes("extensions.lastAppVersion")
      ) {
        return;
      }
      if (line.includes("extensions.zotero.dataDir") && dataDir !== "") {
        return `user_pref("extensions.zotero.dataDir", "${dataDir}");`;
      }
      return line;
    });
    const updatedPrefs = filteredLines.join("\n");
    writeFileSync(prefsPath, updatedPrefs, "utf-8");
    console.log("[info] The <profile>/prefs.js has been modified.");
  }
}

const startZotero = `"${zoteroBinPath}" --debugger --purgecaches -profile ${profilePath}`;

execSync(startZotero);
exit(0);
