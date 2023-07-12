import { build } from "esbuild";
import { zip } from "compressing";
import { join, basename } from "path";
import {
  existsSync,
  lstatSync,
  writeFileSync,
  readFileSync,
  mkdirSync,
  readdirSync,
  rmSync,
  renameSync,
} from "fs";
import { env, exit } from "process";
import replaceInFile from "replace-in-file";
const { sync } = replaceInFile;
import details from "../package.json" assert { type: "json" };

const { name, author, description, homepage, version, config } = details;

const t = new Date();
const buildTime = dateFormat("YYYY-mm-dd HH:MM:SS", new Date());
const buildDir = "build";

function copyFileSync(source, target) {
  var targetFile = target;

  // If target is a directory, a new file with the same name will be created
  if (existsSync(target)) {
    if (lstatSync(target).isDirectory()) {
      targetFile = join(target, basename(source));
    }
  }

  writeFileSync(targetFile, readFileSync(source));
}

function copyFolderRecursiveSync(source, target) {
  var files = [];

  // Check if folder needs to be created or integrated
  var targetFolder = join(target, basename(source));
  if (!existsSync(targetFolder)) {
    mkdirSync(targetFolder);
  }

  // Copy
  if (lstatSync(source).isDirectory()) {
    files = readdirSync(source);
    files.forEach(function (file) {
      var curSource = join(source, file);
      if (lstatSync(curSource).isDirectory()) {
        copyFolderRecursiveSync(curSource, targetFolder);
      } else {
        copyFileSync(curSource, targetFolder);
      }
    });
  }
}

function clearFolder(target) {
  if (existsSync(target)) {
    rmSync(target, { recursive: true, force: true });
  }

  mkdirSync(target, { recursive: true });
}

function dateFormat(fmt, date) {
  let ret;
  const opt = {
    "Y+": date.getFullYear().toString(),
    "m+": (date.getMonth() + 1).toString(),
    "d+": date.getDate().toString(),
    "H+": date.getHours().toString(),
    "M+": date.getMinutes().toString(),
    "S+": date.getSeconds().toString(),
  };
  for (let k in opt) {
    ret = new RegExp("(" + k + ")").exec(fmt);
    if (ret) {
      fmt = fmt.replace(
        ret[1],
        ret[1].length == 1 ? opt[k] : opt[k].padStart(ret[1].length, "0")
      );
    }
  }
  return fmt;
}

function renameLocaleFiles() {
  const localeDir = join(buildDir, "addon/locale");
  const localeFolders = readdirSync(localeDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  for (const localeSubFolder of localeFolders) {
    const localeSubDir = join(localeDir, localeSubFolder);
    const localeSubFiles = readdirSync(localeSubDir, {
      withFileTypes: true,
    })
      .filter((dirent) => dirent.isFile())
      .map((dirent) => dirent.name);

    for (const localeSubFile of localeSubFiles) {
      if (localeSubFile.endsWith(".ftl")) {
        renameSync(
          join(localeSubDir, localeSubFile),
          join(localeSubDir, `${config.addonRef}-${localeSubFile}`)
        );
      }
    }
  }
}

function replaceString() {
  const replaceFrom = [
    /__author__/g,
    /__description__/g,
    /__homepage__/g,
    /__buildVersion__/g,
    /__buildTime__/g,
  ];
  const replaceTo = [author, description, homepage, version, buildTime];

  replaceFrom.push(
    ...Object.keys(config).map((k) => new RegExp(`__${k}__`, "g"))
  );
  replaceTo.push(...Object.values(config));

  const optionsAddon = {
    files: [
      join(buildDir, "**/*.xhtml"),
      join(buildDir, "**/*.json"),
      join(buildDir, "addon/prefs.js"),
      join(buildDir, "addon/manifest.json"),
      join(buildDir, "addon/bootstrap.js"),
      "update.json",
    ],
    from: replaceFrom,
    to: replaceTo,
    countMatches: true,
  };

  const replaceResult = sync(optionsAddon);

  const localeMessage = new Set();
  const localeMessageMiss = new Set();

  const replaceResultFlt = sync({
    files: [join(buildDir, "addon/**/*.ftl")],
    processor: (fltContent) => {
      const lines = fltContent.split("\n");
      const prefixedLines = lines.map((line) => {
        // https://regex101.com/r/lQ9x5p/1
        const match = line.match(
          /^(?<message>[a-zA-Z]\S*)([ ]*=[ ]*)(?<pattern>.*)$/m
        );
        if (match) {
          localeMessage.add(match.groups.message);
          return `${config.addonRef}-${line}`;
        } else {
          return line;
        }
      });
      return prefixedLines.join("\n");
    },
  });

  const replaceResultXhtml = sync({
    files: [join(buildDir, "addon/**/*.xhtml")],
    processor: (input) => {
      const matchs = [...input.matchAll(/(data-l10n-id)="(\S*)"/g)];
      matchs.map((match) => {
        if (localeMessage.has(match[2])) {
          input = input.replace(
            match[0],
            `${match[1]}="${config.addonRef}-${match[2]}"`
          );
        } else {
          localeMessageMiss.add(match[2]);
        }
      });
      return input;
    },
  });

  console.log(
    "[Build] Run replace in ",
    replaceResult
      .filter((f) => f.hasChanged)
      .map((f) => `${f.file} : ${f.numReplacements} / ${f.numMatches}`),
    replaceResultFlt.filter((f) => f.hasChanged).map((f) => `${f.file} : OK`),
    replaceResultXhtml.filter((f) => f.hasChanged).map((f) => `${f.file} : OK`)
  );

  if (localeMessageMiss.size !== 0) {
    console.warn(
      `[Build] [Warn] Fluent message [${new Array(
        ...localeMessageMiss
      )}] do not exsit in addon's locale files.`
    );
  }
}

async function esbuild() {
  await build({
    entryPoints: ["src/index.ts"],
    define: {
      __env__: `"${env.NODE_ENV}"`,
    },
    bundle: true,
    target: "firefox102",
    outfile: join(buildDir, "addon/chrome/content/scripts/index.js"),
    // Don't turn minify on
    // minify: true,
  }).catch(() => exit(1));
}

async function main() {
  console.log(
    `[Build] BUILD_DIR=${buildDir}, VERSION=${version}, BUILD_TIME=${buildTime}, ENV=${[
      env.NODE_ENV,
    ]}`
  );

  clearFolder(buildDir);

  copyFolderRecursiveSync("addon", buildDir);

  copyFileSync("update-template.json", "update.json");

  await esbuild();

  console.log("[Build] Run esbuild OK");

  replaceString();

  console.log("[Build] Replace OK");

  // Walk the builds/addon/locale folder's sub folders and rename *.ftl to addonRef-*.ftl
  renameLocaleFiles();

  console.log("[Build] Addon prepare OK");

  await zip.compressDir(
    join(buildDir, "addon"),
    join(buildDir, `${name}.xpi`),
    {
      ignoreBase: true,
    }
  );

  console.log("[Build] Addon pack OK");
  console.log(
    `[Build] Finished in ${(new Date().getTime() - t.getTime()) / 1000} s.`
  );
}

main().catch((err) => {
  console.log(err);
  exit(1);
});
