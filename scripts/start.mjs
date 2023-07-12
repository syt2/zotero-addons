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
  if (!existsSync(addonProxyFilePath)) {
    console.log("Addon proxy file do not exist, creating it.");
    writeFileSync(addonProxyFilePath, resolve("build/addon"));
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
    console.log("The <profile>/prefs.js modified.");
  }
}

const startZotero = `"${zoteroBinPath}" --debugger --purgecaches -profile ${profilePath}`;

execSync(startZotero);
exit(0);
