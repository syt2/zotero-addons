# Zotero Plugin Template

![GitHub Repo stars](https://img.shields.io/github/stars/windingwind/zotero-better-notes?label=zotero-better-notes)
![GitHub Repo stars](https://img.shields.io/github/stars/windingwind/zotero-pdf-preview?label=zotero-pdf-preview)
![GitHub Repo stars](https://img.shields.io/github/stars/windingwind/zotero-pdf-translate?label=zotero-pdf-translate)
![GitHub Repo stars](https://img.shields.io/github/stars/windingwind/zotero-tag?label=zotero-tag)
![GitHub Repo stars](https://img.shields.io/github/stars/iShareStuff/ZoteroTheme?label=zotero-theme)
![GitHub Repo stars](https://img.shields.io/github/stars/MuiseDestiny/zotero-reference?label=zotero-reference)
![GitHub Repo stars](https://img.shields.io/github/stars/MuiseDestiny/zotero-citation?label=zotero-citation)
![GitHub Repo stars](https://img.shields.io/github/stars/MuiseDestiny/ZoteroStyle?label=zotero-style)
![GitHub Repo stars](https://img.shields.io/github/stars/volatile-static/Chartero?label=Chartero)
![GitHub Repo stars](https://img.shields.io/github/stars/l0o0/tara?label=tara)
![GitHub Repo stars](https://img.shields.io/github/stars/redleafnew/delitemwithatt?label=delitemwithatt)
![GitHub Repo stars](https://img.shields.io/github/stars/redleafnew/zotero-updateifsE?label=zotero-updateifsE)
![GitHub Repo stars](https://img.shields.io/github/stars/inciteful-xyz/inciteful-zotero-plugin?label=inciteful-zotero-plugin)
![GitHub Repo stars](https://img.shields.io/github/stars/MuiseDestiny/zotero-gpt?label=zotero-gpt)
![GitHub Repo stars](https://img.shields.io/github/stars/lifan0127/ai-research-assistant?label=ai-research-assistant)

This is a plugin template for [Zotero](https://www.zotero.org/). Plugins using this template are shown above.

📖[Plugin Development Documentation](https://zotero.yuque.com/books/share/8d230829-6004-4934-b4c6-685a7001bfa0/vec88d)(Chinese, provides English translation)

🛠️[Zotero Plugin Toolkit](https://github.com/windingwind/zotero-plugin-toolkit) | [API Documentation](https://github.com/windingwind/zotero-plugin-toolkit/blob/master/docs/zotero-plugin-toolkit.md)

ℹ️[Zotero Type Definitions](https://github.com/windingwind/zotero-types)

📜[Zotero Source Code](https://github.com/zotero/zotero)

📌[Zotero Plugin Template](https://github.com/windingwind/zotero-plugin-template)(This repo)

> 👁 Watch this repo so that you can be notified whenever there are fixes & updates.

If you are using this repo, I recommended that you put this badge ([![Using Zotero Plugin Template](https://img.shields.io/badge/Using-Zotero%20Plugin%20Template-blue?style=flat-square&logo=github)](https://github.com/windingwind/zotero-plugin-template)) on your README:

```md
[![Using Zotero Plugin Template](https://img.shields.io/badge/Using-Zotero%20Plugin%20Template-blue?style=flat-square&logo=github)](https://github.com/windingwind/zotero-plugin-template)
```

## Features

> ❗The localization system is upgraded (dtd is deprecated and we do not use .properties anymore). Only supports Zotero 7.0.0-beta.12 or higher now. If you want to support Zotero 6, you may need to use `dtd`, `properties`, and `ftl` at the same time. See the staled branch `zotero6-bootstrap`.

- Event-driven, functional programming, under extensive skeleton;
- Simple and user-friendly, works out-of-the-box.
- ⭐[New!]Auto hot reload! Whenever the source code is modified, automatically compile and reload. [See here→](#auto-hot-reload)
- Abundant examples in `src/modules/examples.ts`, covering most of the commonly used APIs in plugins(using [zotero-plugin-toolkit](https://github.com/windingwind/zotero-plugin-toolkit));
- TypeScript support:
  - Full type definition support for the whole Zotero project, which is written in JavaScript(using [zotero-types](https://github.com/windingwind/zotero-types));
  - Global variables and environment setup;
- Plugin build/test/release workflow:
  - Automatically generate/update plugin id/version, update configrations, and set environment variables(`development/production`);
  - Automatically build and reload code in Zotero;
  - Automatically release to GitHub(using [release-it](https://github.com/release-it/release-it));

## Examples

This repo provides examples for [zotero-plugin-toolkit](https://github.com/windingwind/zotero-plugin-toolkit) APIs.

Search `@example` in `src/examples.ts`. The examples are called in `src/hooks.ts`.

### Basic Examples

- registerNotifier
- registerPrefs, unregisterPrefs

### Shortcut Keys Examples

- registerShortcuts
- exampleShortcutLargerCallback
- exampleShortcutSmallerCallback
- exampleShortcutConflictionCallback

### UI Examples

![image](https://user-images.githubusercontent.com/33902321/211739774-cc5c2df8-5fd9-42f0-9cdf-0f2e5946d427.png)

- registerStyleSheet(the official make-it-red example)
- registerRightClickMenuItem
- registerRightClickMenuPopup
- registerWindowMenuWithSeprator
- registerExtraColumn
- registerExtraColumnWithCustomCell
- registerCustomItemBoxRow
- registerCustomCellRenderer
- registerLibraryTabPanel
- registerReaderTabPanel

### Preference Pane Examples

![image](https://user-images.githubusercontent.com/33902321/211737987-cd7c5c87-9177-4159-b975-dc67690d0490.png)

- Preferences bindings
- UI Events
- Tabel
- Locale

See [`src/modules/preferenceScript.ts`](./src/modules/preferenceScript.ts)

### HelperExamples

![image](https://user-images.githubusercontent.com/33902321/215119473-e7d0d0ef-6d96-437e-b989-4805ffcde6cf.png)

- dialogExample
- clipboardExample
- filePickerExample
- progressWindowExample
- vtableExample(See Preference Pane Examples)

### PromptExamples

An Obsidian-style prompt(popup command input) module. It accepts text command to run callback, with optional display in the popup.

Activate with `Shift+P`.

![image](https://user-images.githubusercontent.com/33902321/215120009-e7c7ed27-33a0-44fe-b021-06c272481a92.png)

- registerAlertPromptExample

## Quick Start Guide

### Install Pre-built `xpi`

See how the examples work by directly downloading the `xpi` file from GitHub release and install it to your Zotero.

This is also how your plugin will be released and used by others.

> The release do not promise any real functions. It is probably not up-to-date.
>
> The `xpi` package is a zip file. However, please don't modify it directly. Modify the source code and build it.

### Build from Source

- Fork this repo/Click `Use this template`;
- Git clone the forked repo;
- Enter the repo folder;
- Modify the settings in `./package.json`, including:

```json5
{
  version,
  author,
  description,
  homepage,
  config {
    releasepage, // URL to releases(`.xpi`)
    updaterdf, // URL to update.json
    addonName, // name to be displayed in the plugin manager
    addonID, // ID to avoid confliction. IMPORTANT!
    addonRef, // e.g. Element ID prefix
    addonInstance // the plugin's root instance: Zotero.${addonInstance}
  }
}
```

> Be careful to set the addonID and addonRef to avoid confliction.

- Run `npm install` to set up the plugin and install dependencies. If you don't have NodeJS installed, please download it [here](https://nodejs.org/en/);
- Run `npm run build` to build the plugin in production mode. Run `npm run build-dev` to build the plugin in development mode. The xpi for installation and the built code is under `builds` folder.

> What the difference between dev & prod?
>
> - This environment variable is stored in `Zotero.${addonInstance}.data.env`. The outputs to console is disabled in prod mode.
> - You can decide what users cannot see/use based on this variable.

### Release

To build and release, use

```shell
# A release-it command: version increase, npm run build, git push, and GitHub release
# You need to set the environment variable GITHUB_TOKEN https://github.com/settings/tokens
# release-it: https://github.com/release-it/release-it
npm run release
```

### Setup Development Environment

1. Install a beta version of Zotero: https://www.zotero.org/support/beta_builds (Zotero 7 beta: https://www.zotero.org/support/dev/zotero_7_for_developers)

2. Install Firefox 102(for Zotero 7)

3. Copy zotero command line config file. Modify the commands that starts your installation of the beta Zotero.

> (Optional) Do this only once: Start the beta Zotero with `/path/to/zotero -p`. Create a new profile and use it as your development profile.
> Use `/path/to/zotero -p {profile_name}` to specify which profile to run with.

```sh
cp ./scripts/zotero-cmd-default.json ./scripts/zotero-cmd.json
vim ./scripts/zotero-cmd.json
```

4. Setup plugin development environment following this [link](https://www.zotero.org/support/dev/client_coding/plugin_development#setting_up_a_plugin_development_environment).

5. Build plugin and restart Zotero with `npm run restart`.

6. Launch Firefox 102(Zotero 7)

7. In Firefox, go to devtools, go to settings, click "enable remote debugging" and the one next to it that's also about debugging

> Enter `about:debugging#/setup` in FF 102.

8. In Zotero, go to setting, advanced, config editor, look up "debugging" and click on "allow remote debugging".

9. Connect to Zotero in Firefox. In FF 102, enter `localhost:6100` in the bottom input of remote-debugging page and click `add`.

10. Click `connect` in the leftside-bar of Firefox remote-debugging page.

11. Click "Inspect Main Process"

### Auto Hot Reload

Tired of endless restarting? Forget about it!

1. Run `npm run start-watch`. (If Zotero is already running, use `npm run watch`)
2. Coding. (Yes, that's all)

When file changes are detected in `src` or `addon`, the plugin will be automatically compiled and reloaded.

<details style="text-indent: 2em">
<summary>💡 Steps to add this feature to an existing plugin</summary>

1. Copy `scripts/reload.mjs`
2. Copy `reload`, `watch`, and `start-watch` commands in `package.json`
3. Run `npm install --save-dev chokidar-cli`
4. Done.

</details>

### Debug in Zotero

You can also:

- Test code snipastes in Tools->Developer->Run Javascript;
- Debug output with `Zotero.debug()`. Find the outputs in Help->Debug Output Logging->View Output;
- Debug UI. Zotero is built on the Firefox XUL framework. Debug XUL UI with software like [XUL Explorer](https://udn.realityripple.com/docs/Archive/Mozilla/XUL_Explorer).
  > XUL Documentation: http://www.devdoc.net/web/developer.mozilla.org/en-US/docs/XUL.html

## Details

### About Hooks

> See also [`src/hooks.ts`](https://github.com/windingwind/zotero-plugin-template/blob/bootstrap/src/hooks.ts)

1. When install/enable/startup triggered from Zotero, `bootstrap.js` > `startup` is called
   - Wait for Zotero ready
   - Load `index.js` (the main entrance of plugin code, built from `index.ts`)
   - Register resources if Zotero 7+
2. In the main entrance `index.js`, the plugin object is injected under `Zotero` and `hooks.ts` > `onStartup` is called.
   - Initialize anything you want, including notify listeners, preference panes, and UI elements.
3. When uninstall/disabled triggered from Zotero, `bootstrap.js` > `shutdown` is called.
   - `events.ts` > `onShutdown` is called. Remove UI elements, preference panes, or anything created by the plugin.
   - Remove scripts and release resources.

### About Global Variables

> See also [`src/index.ts`](https://github.com/windingwind/zotero-plugin-template/blob/bootstrap/src/index.ts)

The bootstrapped plugin runs in a sandbox, which does not have default global variables like `Zotero` or `window`, which we used to have in the overlay plugins' window environment.

This template registers the following variables to the global scope:

```ts
Zotero, ZoteroPane, Zotero_Tabs, window, document, rootURI, ztoolkit, addon;
```

### Create Elements API

The plugin template provides new APIs for bootstrap plugins. We have two reasons to use these APIs, instead of the `createElement/createElementNS`:

- In bootstrap mode, plugins have to clean up all UI elements on exit (disable or uninstall), which is very annoying. Using the `createElement`, the plugin template will maintain these elements. Just `unregisterAll` at the exit.
- Zotero 7 requires createElement()/createElementNS() → createXULElement() for remaining XUL elements, while Zotero 6 doesn't support `createXULElement`. The React.createElement-like API `createElement` detects namespace(xul/html/svg) and creates elements automatically, with the return element in the corresponding TS element type.

```ts
createElement(document, "div"); // returns HTMLDivElement
createElement(document, "hbox"); // returns XUL.Box
createElement(document, "button", { namespace: "xul" }); // manually set namespace. returns XUL.Button
```

### About Build

Use Esbuild to build `.ts` source code to `.js`.

Use `replace-in-file` to replace keywords and configurations defined in `package.json` in non-build files (`.xul/xhtml`, `.dtd`, and `.properties`).

Steps in `scripts/build.js`:

1. Clean `./builds`
2. Copy `./addon` to `./builds`
3. Esbuild to `./builds/addon/chrome/content/scripts`
4. Replace `__buildVersion__` and `__buildTime__` in `./builds/addon`
5. Zip the `./builds/addon` to `./builds/*.xpi`

### About Zotero API

Zotero docs are outdated and incomplete. Clone https://github.com/zotero/zotero and search the keyword globally.

> ⭐The [zotero-types](https://github.com/windingwind/zotero-types) provides most frequently used Zotero APIs. It's included in this template by default. Your IDE would provide hint for most of the APIs.

A trick for finding the API you want:

Search the UI label in `.xul`(`.xhtml`)/`.dtd`/`.properties` files, find the corresponding key in locale file. Then search this keys in `.js`/`.jsx` files.

### Directory Structure

This section shows the directory structure of a template.

- All `.js/.ts` code files are in `./src`;
- Addon config files: `./addon/chrome.manifest`, `./addon/install.rdf`, and `./addon/manifest.json`;
- UI files: `./addon/chrome/content/*.xhtml`.
- Locale files: `./addon/chrome/locale/[*.dtd, *.properties]`;
- Resource files: `./addon/chrome/skin/default/__addonRef__/*.dtd`;
- Preferences file: `./addon/chrome/defaults/preferences/defaults.js`;
  > Don't break the lines in the `defaults.js`

```shell
│  .gitignore
│  .release-it.json # release-it conf
|  tsconfig.json    # https://code.visualstudio.com/docs/languages/jsconfig#
│  build.js         # esbuild
│  LICENSE
│  package.json     # npm conf
│  README.md        # readme
│  update.rdf       # addon update
│
├─.github           # github conf
│
├─addon             # addon dir
│  │  manifest.json # addon config
│  │  bootstrap.js  # addon load/unload script, like a main.c
│  │
│  └─chrome
│      ├─content    # UI
│      │  │  preferences.xhtml
│      │  │
│      │  ├─icons
│      │  │      favicon.png
│      │  │      favicon@0.5x.png
│      │  │
│      │  └─scripts
│      └─locale     # locale
│         ├─en-US
│         │      overlay.dtd
│         │      addon.properties
│         │
│         ├─zh-CN
│         |      overlay.dtd
│         └─     addon.properties
│
├─builds            # build dir
│  └─.xpi
│
└─src               # source code
    │  index.ts     # main entry
    │  addon.ts     # base class
    │  hooks.ts     # lifecycle hooks
    |
    └─modules       # sub modules
       │  examples.ts           # examples factory
       │  locale.ts             # locale .properties
       │  preferenceScript.ts   # script runs in preferences.xhtml
       └─ progressWindow.ts     # progressWindow tool
```

## Disclaimer

Use this code under AGPL. No warranties are provided. Keep the laws of your locality in mind!

If you want to change the license, please contact me at wyzlshx@foxmail.com
