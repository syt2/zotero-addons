# Zotero Plugin Template

[![zotero target version](https://img.shields.io/badge/Zotero-7-green?style=flat-square&logo=zotero&logoColor=CC2936)](https://www.zotero.org)
[![Using Zotero Plugin Template](https://img.shields.io/badge/Using-Zotero%20Plugin%20Template-blue?style=flat-square&logo=github)](https://github.com/windingwind/zotero-plugin-template)

这是 [Zotero](https://www.zotero.org/) 的插件模板.

[English](../README.md) | [简体中文](./README-zhCN.md)

使用此模板创建的一些插件:

[![GitHub Repo stars](https://img.shields.io/github/stars/windingwind/zotero-better-notes?label=zotero-better-notes&style=flat-square)](https://github.com/windingwind/zotero-better-notes)
[![GitHub Repo stars](https://img.shields.io/github/stars/windingwind/zotero-pdf-preview?label=zotero-pdf-preview&style=flat-square)](https://github.com/windingwind/zotero-pdf-preview)
[![GitHub Repo stars](https://img.shields.io/github/stars/windingwind/zotero-pdf-translate?label=zotero-pdf-translate&style=flat-square)](https://github.com/windingwind/zotero-pdf-translate)
[![GitHub Repo stars](https://img.shields.io/github/stars/windingwind/zotero-tag?label=zotero-tag&style=flat-square)](https://github.com/windingwind/zotero-tag)
[![GitHub Repo stars](https://img.shields.io/github/stars/iShareStuff/ZoteroTheme?label=zotero-theme&style=flat-square)](https://github.com/iShareStuff/ZoteroTheme)
[![GitHub Repo stars](https://img.shields.io/github/stars/MuiseDestiny/zotero-reference?label=zotero-reference&style=flat-square)](https://github.com/MuiseDestiny/zotero-reference)
[![GitHub Repo stars](https://img.shields.io/github/stars/MuiseDestiny/zotero-citation?label=zotero-citation&style=flat-square)](https://github.com/MuiseDestiny/zotero-citation)
[![GitHub Repo stars](https://img.shields.io/github/stars/MuiseDestiny/ZoteroStyle?label=zotero-style&style=flat-square)](https://github.com/MuiseDestiny/ZoteroStyle)
[![GitHub Repo stars](https://img.shields.io/github/stars/volatile-static/Chartero?label=Chartero&style=flat-square)](https://github.com/volatile-static/Chartero)
[![GitHub Repo stars](https://img.shields.io/github/stars/l0o0/tara?label=tara&style=flat-square)](https://github.com/l0o0/tara)
[![GitHub Repo stars](https://img.shields.io/github/stars/redleafnew/delitemwithatt?label=delitemwithatt&style=flat-square)](https://github.com/redleafnew/delitemwithatt)
[![GitHub Repo stars](https://img.shields.io/github/stars/redleafnew/zotero-updateifsE?label=zotero-updateifsE&style=flat-square)](https://github.com/redleafnew/zotero-updateifsE)
[![GitHub Repo stars](https://img.shields.io/github/stars/northword/zotero-format-metadata?label=zotero-format-metadata&style=flat-square)](https://github.com/northword/zotero-format-metadata)
[![GitHub Repo stars](https://img.shields.io/github/stars/inciteful-xyz/inciteful-zotero-plugin?label=inciteful-zotero-plugin&style=flat-square)](https://github.com/inciteful-xyz/inciteful-zotero-plugin)
[![GitHub Repo stars](https://img.shields.io/github/stars/MuiseDestiny/zotero-gpt?label=zotero-gpt&style=flat-square)](https://github.com/MuiseDestiny/zotero-gpt)
[![GitHub Repo stars](https://img.shields.io/github/stars/zoushucai/zotero-journalabbr?label=zotero-journalabbr&style=flat-square)](https://github.com/zoushucai/zotero-journalabbr)
[![GitHub Repo stars](https://img.shields.io/github/stars/MuiseDestiny/zotero-figure?label=zotero-figure&style=flat-square)](https://github.com/MuiseDestiny/zotero-figure)
[![GitHub Repo stars](https://img.shields.io/github/stars/MuiseDestiny/zotero-file?label=WanderingFile&style=flat-square)](https://github.com/MuiseDestiny/zotero-file)
[![GitHub Repo stars](https://img.shields.io/github/stars/l0o0/jasminum?label=jasminum&style=flat-square)](https://github.com/l0o0/jasminum)
[![GitHub Repo stars](https://img.shields.io/github/stars/lifan0127/ai-research-assistant?label=ai-research-assistant&style=flat-square)](https://github.com/lifan0127/ai-research-assistant)

📖 [插件开发文档](https://zotero.yuque.com/books/share/8d230829-6004-4934-b4c6-685a7001bfa0/vec88d) (中文版)

🛠️ [Zotero 插件工具包](https://github.com/windingwind/zotero-plugin-toolkit) | [API 文档](https://github.com/windingwind/zotero-plugin-toolkit/blob/master/docs/zotero-plugin-toolkit.md)

ℹ️ [Zotero 类型定义](https://github.com/windingwind/zotero-types)

📜 [Zotero 源代码](https://github.com/zotero/zotero)

📌 [Zotero 插件模板](https://github.com/windingwind/zotero-plugin-template) (即当前库)

> 👁 关注此库，以便在有修复或更新时及时收到通知.

如果你正在使用此库，我建议你将这个标志 ([![Using Zotero Plugin Template](https://img.shields.io/badge/Using-Zotero%20Plugin%20Template-blue?style=flat-square&logo=github)](https://github.com/windingwind/zotero-plugin-template)) 放在 README 文件中:

```md
[![Using Zotero Plugin Template](https://img.shields.io/badge/Using-Zotero%20Plugin%20Template-blue?style=flat-square&logo=github)](https://github.com/windingwind/zotero-plugin-template)
```

## Features 特性

> ❗Zotero系统已升级(dtd 已弃用，我们将不在使用 .properties). 主分支将只支持 Zotero 7.0.0-beta.12 或更高版本. 如果需要支持 Zotero 6，可能需要同时使用`dtd`、`properties` 和`ftl`. 请参考此库的 `zotero6-bootstrap` 分支.

- 事件驱动、函数式编程的可扩展框架；
- 简单易用，开箱即用；
- ⭐[新特性!]自动热重载！每当修改源码时，都会自动编译并重新加载插件；[详情请跳转→](#auto-hot-reload)
- `src/modules/examples.ts` 中有丰富的示例，涵盖了插件中常用的大部分API(使用的插件工具包 [zotero-plugin-toolkit](https://github.com/windingwind/zotero-plugin-toolkit))；
- TypeScript 支持:
  - 为使用 JavaScript 编写的Zotero源码提供全面的类型定义支持(使用类型定义包[zotero-types](https://github.com/windingwind/zotero-types))；
  - 全局变量和环境设置；
- 插件构建/测试/发布工作流:
  - 自动生成/更新插件id和版本、更新配置和设置环境变量 (`development/production`)；
  - 自动在 Zotero 中构建和重新加载代码；
  - 自动发布到GitHub (使用[release-it](https://github.com/release-it/release-it));

## Examples 示例

此库提供了 [zotero-plugin-toolkit](https://github.com/windingwind/zotero-plugin-toolkit) 中API的示例.

在 `src/examples.ts` 中搜索`@example` 查看示例. 这些示例在 `src/hooks.ts` 中调用演示.

### 基本示例(Basic Examples)

- registerNotifier
- registerPrefs, unregisterPrefs

### 快捷键示例(Shortcut Keys Examples)

- registerShortcuts
- exampleShortcutLargerCallback
- exampleShortcutSmallerCallback
- exampleShortcutConflictionCallback

### UI示例(UI Examples)

![image](https://user-images.githubusercontent.com/33902321/211739774-cc5c2df8-5fd9-42f0-9cdf-0f2e5946d427.png)

- registerStyleSheet(the official make-it-red example)
- registerRightClickMenuItem
- registerRightClickMenuPopup
- registerWindowMenuWithSeprator
- registerExtraColumn
- registerExtraColumnWithCustomCell
- registerCustomItemBoxRow
- registerLibraryTabPanel
- registerReaderTabPanel

### 首选项面板示例(Preference Pane Examples)

![image](https://user-images.githubusercontent.com/33902321/211737987-cd7c5c87-9177-4159-b975-dc67690d0490.png)

- Preferences bindings
- UI Events
- Tabel
- Locale

详情参见 [`src/modules/preferenceScript.ts`](./src/modules/preferenceScript.ts)

### 帮助示例(HelperExamples)

![image](https://user-images.githubusercontent.com/33902321/215119473-e7d0d0ef-6d96-437e-b989-4805ffcde6cf.png)

- dialogExample
- clipboardExample
- filePickerExample
- progressWindowExample
- vtableExample(See Preference Pane Examples)

### 指令行示例(PromptExamples)

Obsidian风格的指令输入模块，它通过接受文本来运行插件，并在弹出窗口中显示可选项.

使用 `Shift+P` 激活.

![image](https://user-images.githubusercontent.com/33902321/215120009-e7c7ed27-33a0-44fe-b021-06c272481a92.png)

- registerAlertPromptExample

## Quick Start Guide 快速入门指南

### 安装预构建 `xpi`

通过直接在GitHub中下载构建好的 `xpi` 文件并将其安装到Zotero中来了解示例的工作原理.

这也是你发布插件的格式，同时这也将是其他人可以直接使用的版本.

> 该库构建好的xpi文件不具有任何实际功能，它可能不随Zotero更新而随时更新.
>
> `xpi` 文件实际上是一个zip压缩包，然而，请不要直接修改它，而是修改源代码并重新构建它.

### 从源码构建(Build from Source)

- Fork 此库或者使用 `Use this template`；
- 使用 `git clone ` 克隆此库；
- 进入项目文件夹；
<details >
<summary>💡 从 GitHub Codespace 开始</summary>

_GitHub CodeSpace_ 使你可以直接开始开发而无需在本地下载代码/IDE/依赖.

重复下列步骤，仅需三十秒即可开始构建你的第一个插件！

- 去 [homepage](https://github.com/windingwind/zotero-plugin-template)顶部，点击绿色按钮`Use this template`，点击 `Open in codespace`， 你需要登录你的GitHub账号.
- 等待 codespace 加载.
- 修改 `./package.json` 中的设置，包括：
  </details>

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
      addonID, // ID to avoid conflict. IMPORTANT!
      addonRef, // e.g. Element ID prefix
      addonInstance // the plugin's root instance: Zotero.${addonInstance}
    }
  }
  ```

  > 注意设置 addonID 和 addonRef 以避免冲突.

- 运行 `npm install` 以设置插件并安装相关依赖. 如果你没有安装 Node.js，请在[此处下载](https://nodejs.org/en/);
- 运行 `npm run build` 以在生产模式下构建插件，运行 `npm run build-dev` 以在开发模式下构建插件. 用于安装的 xpi 文件和用于构建的代码在 `build` 文件夹下.

  > Dev & prod 两者有什么区别?
  >
  > - 此环境变量存储在 `Zotero.${addonInstance}.data.env` 中，控制台输出在生产模式下被禁用.
  > - 你可以根据此变量决定用户无法查看/使用的内容.

### 发布(Release)

如果要构建和发布插件，运行如下指令：

```shell
# A release-it command: version increase, npm run build, git push, and GitHub release
# You need to set the environment variable GITHUB_TOKEN https://github.com/settings/tokens
# release-it: https://github.com/release-it/release-it
npm run release
```

### 设置开发环境(Setup Development Environment)

1. 安装 Zotero: <https://www.zotero.org/support/beta_builds> (Zotero 7 beta: <https://www.zotero.org/support/dev/zotero_7_for_developers>)

2. 安装 Firefox 102 (适用于 Zotero 7)

3. 复制 zotero 命令行配置文件，修改开始安装 beta Zotero 的命令.

   > (可选项) 此操作仅需执行一次: 使用 `/path/to/zotero -p` 启动 Zotero，创建一个新的配置文件并用作开发配置文件.
   > 将配置文件的路径 `profilePath` 放入 `zotero-cmd.json` 中，以指定要使用的配置文件.

   ```sh
   cp ./scripts/zotero-cmd-default.json ./scripts/zotero-cmd.json
   vim ./scripts/zotero-cmd.json
   ```

4. 构建插件并使用 `npm run restart` 重启 Zotero.

5. 启动 Firefox 102 (Zotero 7)

6. 在 Firefox 中，转到devtools，转到设置，单击 "enable remote debugging" ，同时，旁边的按钮也是关于调试的。

   > 在 FirFox 102 中输入 `about:debugging#/setup` .

7. 在 Zotero 中，进入设置-高级-编辑器，搜索 "debugging" 然后单击 "allow remote debugging".

8. 在 Firefox 中连接 Zotero. 在 FireFox 102中，在远程调试页面底部输入 `localhost:6100` 然后单击 `add`.

9. 在远程调试页面左侧栏点击 `connect`.

10. 点击 "Inspect Main Process"

### 自动热重载(Auto Hot Reload)

厌倦了无休止的重启吗？忘掉它，拥抱热加载！

1. 运行 `npm run start-watch`. (如果Zotero已经在运行，请使用 `npm run watch`)
2. 编码. (是的，就这么简单)

当检测到 `src` 或 `addon` 中的文件修改时，插件将自动编译并重新加载.

<details style="text-indent: 2em">
<summary>💡 将此功能添加到现有插件的步骤</summary>

1. 复制 `scripts/reload.mjs`
2. 复制 `reload` 、`watch` 和 `start-watch` 命令 `package.json`
3. 运行 `npm install --save-dev chokidar-cli`
4. 结束.

</details>

### 在 Zotero 中调试

你还可以:

- 在 Tools->Developer->Run Javascript 中测试代码片段;
- 使用 `Zotero.debug()` 调试输出. 在 Help->Debug Output Logging->View Output 查看输出;
- 调试 UI. Zotero 建立在 Firefox XUL 框架之上. 使用 [XUL Explorer](https://udn.realityripple.com/docs/Archive/Mozilla/XUL_Explorer) 等软件调试 XUL UI.
  > XUL 文档: <http://www.devdoc.net/web/developer.mozilla.org/en-US/docs/XUL.html>

## Details 更多细节

### 关于Hooks(About Hooks)

> 可以在 [`src/hooks.ts`](https://github.com/windingwind/zotero-plugin-template/blob/bootstrap/src/hooks.ts) 中查看更多

1. 当在 Zotero 中触发安装/启用/启动时，`bootstrap.js` > `startup` 被调用
   - 等待 Zotero 就绪
   - 加载 `index.js` (插件代码的主入口，从 `index.ts` 中构建)
   - 如果是 Zotero 7 以上的版本则注册资源
2. 主入口 `index.js` 中，插件对象被注入到 `Zotero` ，并且 `hooks.ts` > `onStartup` 被调用.
   - 初始化插件需要的资源，包括通知监听器、首选项面板和UI元素.
3. 当在 Zotero 中触发卸载/禁用时，`bootstrap.js` > `shutdown` 被调用.
   - `events.ts` > `onShutdown` 被调用. 移除 UI 元素、首选项面板或插件创建的任何内容.
   - 移除脚本并释放资源.

### 关于全局变量(About Global Variables)

> 可以在 [`src/index.ts`](https://github.com/windingwind/zotero-plugin-template/blob/bootstrap/src/index.ts) 中查看更多

引导插件在沙盒中运行，但沙盒中没有默认的全局变量，例如 `Zotero` 或 `window` 等我们曾在覆盖插件环境中使用的变量.

此模板将以下变量注册到全局范围:

```ts
Zotero, ZoteroPane, Zotero_Tabs, window, document, rootURI, ztoolkit, addon;
```

### 创建元素 API(Create Elements API)

插件模板为 bootstrap 插件提供了一些新的API. 我们有两个原因使用这些 API，而不是使用 `createElement/createElementNS`：

- 在 bootstrap 模式下，插件必须在推出（禁用或卸载）时清理所有 UI 元素，这非常麻烦. 使用 `createElement`，插件模板将维护这些元素. 仅仅在退出时 `unregisterAll` .
- Zotero 7 需要 createElement()/createElementNS() → createXULElement() 来表示其他的 XUL 元素，而 Zotero 6 并不支持 `createXULElement`. 类似于 React.createElement 的API `createElement` 检测 namespace(xul/html/svg) 并且自动创建元素，返回元素为对应的 TypeScript 元素类型.

```ts
createElement(document, "div"); // returns HTMLDivElement
createElement(document, "hbox"); // returns XUL.Box
createElement(document, "button", { namespace: "xul" }); // manually set namespace. returns XUL.Button
```

### 关于构建(About Build)

使用 Esbuild 将 `.ts` 源代码构建为 `.js`.

使用 `replace-in-file` 去替换在 `package.json` 中定义的关键字和配置 (`xhtml`、`.flt` 等).

步骤 `scripts/build.mjs`:

1. 清理 `./build`
2. 复制 `./addon` 到 `./build`
3. Esbuild 到 `./build/addon/chrome/content/scripts`
4. 替换`__buildVersion__` 和 `__buildTime__` 在 `./build/addon`
5. 压缩 `./build/addon` 到 `./build/*.xpi`

### 关于 Zotero API(About Zotero API)

Zotero 文档已过时且不完整，git clone https://github.com/zotero/zotero 并全局搜索关键字.

> ⭐[zotero-types](https://github.com/windingwind/zotero-types) 提供了最常用的 Zotero API，在默认情况下它被包含在此模板中. 你的 IDE 将为大多数的 API 提供提醒.

猜你需要：查找所需 API的技巧

在 `.xhtml`/`.flt` 文件中搜索 UI 标签，然后在 locale 文件中找到对应的键. ，然后在 `.js`/`.jsx` 文件中搜索此键.

### 目录结构(Directory Structure)

本部分展示了模板的目录结构.

- 所有的 `.js/.ts` 代码都在 `./src`;
- 插件配置文件：`./addon/manifest.json`;
- UI 文件: `./addon/chrome/content/*.xhtml`.
- 区域设置文件: `./addon/locale/**/*.flt`;
- 首选项文件: `./addon/prefs.js`;
  > 不要在 `prefs.js` 中换行

```shell
.
|-- .eslintrc.json            # eslint conf
|-- .gitattributes            # git conf
|-- .github/                  # github conf
|-- .gitignore                # git conf
|-- .prettierrc               # prettier conf
|-- .release-it.json          # release-it conf
|-- .vscode                   # vs code conf
|   |-- extensions.json
|   |-- launch.json
|   |-- setting.json
|   `-- toolkit.code-snippets
|-- package-lock.json         # npm conf
|-- package.json              # npm conf
|-- LICENSE
|-- README.md
|-- addon
|   |-- bootstrap.js               # addon load/unload script, like a main.c
|   |-- chrome
|   |   `-- content
|   |       |-- icons/
|   |       |-- preferences.xhtml  # preference panel
|   |       `-- zoteroPane.css
|   |-- locale                     # locale
|   |   |-- en-US
|   |   |   |-- addon.ftl
|   |   |   `-- preferences.ftl
|   |   `-- zh-CN
|   |       |-- addon.ftl
|   |       `-- preferences.ftl
|   |-- manifest.json              # addon config
|   `-- prefs.js
|-- build/                         # build dir
|-- scripts                        # scripts for dev
|   |-- build.mjs                  # esbuild and replace
|   |-- reload.mjs
|   |-- start.mjs
|   |-- stop.mjs
|   `-- zotero-cmd-default.json
|-- src                           # source code
|   |-- addon.ts                  # base class
|   |-- hooks.ts                  # lifecycle hooks
|   |-- index.ts                  # main entry
|   |-- modules                   # sub modules
|   |   |-- examples.ts
|   |   `-- preferenceScript.ts
|   `-- utils                     # utilities
|       |-- locale.ts
|       |-- prefs.ts
|       |-- wait.ts
|       `-- window.ts
|-- tsconfig.json                 # https://code.visualstudio.com/docs/languages/jsconfig
|-- typings                       # ts typings
|   `-- global.d.ts
|-- update-template.json          # template of `update.json`
`-- update.json
```

## Disclaimer 免责声明

在 AGPL 下使用此代码. 不提供任何保证. 遵守你所在地区的法律！

如果你想更改许可，请通过 <wyzlshx@foxmail.com> 与我联系.
