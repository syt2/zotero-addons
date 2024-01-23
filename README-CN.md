# <img align="center" src="addon/chrome/content/icons/favicon.png" width=80/> Zotero Addons

[![zotero target version](https://img.shields.io/badge/Zotero-7-green?style=flat-square&logo=zotero&logoColor=CC2936)](https://www.zotero.org)
[![Using Zotero Plugin Template](https://img.shields.io/badge/Using-Zotero%20Plugin%20Template-blue?style=flat-square&logo=github)](https://github.com/windingwind/zotero-plugin-template)
[![Using Zotero Chinese Plugins](https://img.shields.io/badge/Using-Zotero%20Chinese%20Plugins-blue?style=flat-square&logo=github)](https://github.com/zotero-chinese/zotero-plugins)
[![Using Zotero Scraper](https://img.shields.io/badge/Using-Zotero%20Addons%20Scraper-blue?style=flat-square&logo=github)](https://github.com/syt2/zotero-addons-scraper)  
[![Release](https://img.shields.io/github/v/release/syt2/zotero-addons?style=flat-square&logo=github&color=red)](https://github.com/syt2/zotero-addons/releases/latest)
![Downloads@all](https://img.shields.io/github/downloads/syt2/zotero-addons/total?style=flat-square&logo=github)
![Downloads@latest](https://img.shields.io/github/downloads/syt2/zotero-addons/latest/total?style=flat-square&logo=github)

[English](README.md) | [简体中文](README-CN.md)

## 简介

这是一个用于在 [Zotero 7](https://www.zotero.org) 内展示和安装插件的 [Zotero 7](https://www.zotero.org) 插件

> 对于 Zotero 6, 请[点击此处查看](https://github.com/syt2/zotero-addons/tree/z6#readme).

## 安装

1. 下载[最新版xpi安装包](https://github.com/syt2/zotero-addons/releases/latest/download/zotero-addons.xpi) (仅支持 **Zotero 7**)

   > 对于 Zotero 6, 请下载此[xpi安装包](https://github.com/syt2/zotero-addons/releases/download/0.6.0-6/zotero-addons.xpi).

2. 在 Zotero 内安装 `(工具) -> (附加组件)`

## 使用方法

安装完成后，点击工具栏的 <img align="center" src="addon/chrome/content/icons/favicon.png" width=24/> 按钮

## 插件数据源

对于国内用户，若遇到插件页面空白、加载不出插件的情况，请尝试切换不同的数据源  
插件提供**自动源**选项，将会自动选择可连接的源

### [zotero-chinese/zotero-plugins](https://github.com/zotero-chinese/zotero-plugins)

插件主数据源来自Zotero中文社区 **[zotero-chinese/zotero-plugins](https://github.com/zotero-chinese/zotero-plugins)**.

在插件列表界面选择 `(zotero中文社区)` 即可使用该数据源

> 若你有新的插件想要添加到插件源内，请提交至 [zotero-chinese/zotero-plugins](https://github.com/zotero-chinese/zotero-plugins).

### [syt2/zotero-addons-scraper](https://github.com/syt2/zotero-addons-scraper)

在插件列表界面选择 `(插件爬虫)` 即可使用该数据源

### 自定义源

任何符合 [zotero-chinese/zotero-plugins](https://github.com/zotero-chinese/zotero-plugins) 格式的数据源都可用作本插件的数据源，你可以在插件内选择`自定义源`并提供数据源URL即可

## 开发

### Scheme

- 自定义数据源Scheme

  `zotero://zoteroaddoncollection/configSource?source=source-custom&customURL={encodeURIComponent(SOME URL)}`
  将自动切换到指定的URL作为自定义数据源使用

- 从URL安装插件Scheme

  `zotero://zoteroaddoncollection/install?source={encodeURIComponent(SOME URL)}`
  将从指定的URL安装插件

## Star 历史

<a href="https://star-history.com/#syt2/zotero-addons&Timeline">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=syt2/zotero-addons&type=Timeline&theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=syt2/zotero-addons&type=Timeline" />
    <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=syt2/zotero-addons&type=Timeline" />
  </picture>
</a>
