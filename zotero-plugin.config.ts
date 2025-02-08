import { defineConfig } from "zotero-plugin-scaffold";
import pkg from "./package.json";

export default defineConfig({
  source: ["src", "addon"],
  dist: ".scaffold/build",
  name: "__MSG_name__",
  xpiName: pkg.name,
  id: pkg.config.addonID,
  namespace: pkg.config.addonRef,
  updateURL: `https://github.com/{{owner}}/{{repo}}/releases/download/release/${pkg.version.includes("-") ? "update-beta.json" : "update.json"
    }`,
  xpiDownloadLink:
    "https://github.com/{{owner}}/{{repo}}/releases/download/V{{version}}/{{xpiName}}.xpi",
  server: {
    asProxy: true,
  },

  build: {
    assets: ["addon/**/*.*"],
    define: {
      ...pkg.config,
      author: pkg.author,
      homepage: pkg.homepage,
      buildVersion: pkg.version,
      buildTime: "{{buildTime}}",
    },
    // prefs: {
    //   prefix: pkg.config.prefsPrefix,
    // },
    esbuildOptions: [
      {
        entryPoints: ["src/index.ts"],
        define: {
          __env__: `"${process.env.NODE_ENV}"`,
        },
        bundle: true,
        target: "firefox115",
        outfile: `.scaffold/build/addon/content/scripts/${pkg.config.addonRef}.js`,
      },
    ],
  },
  release: {
    bumpp: {
      commit: "chore(publish): release V%s",
      tag: "V%s",
    }
  },
  // If you need to see a more detailed log, uncomment the following line:
  // logLevel: "trace",
});