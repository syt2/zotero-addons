# Zotero Addons

[![zotero target version](https://img.shields.io/badge/Zotero-7-green?style=flat-square&logo=zotero&logoColor=CC2936)](https://www.zotero.org)
[![Using Zotero Plugin Template](https://img.shields.io/badge/Using-Zotero%20Plugin%20Template-blue?style=flat-square&logo=github)](https://github.com/windingwind/zotero-plugin-template)

## Introduction

This is a Zotero Addon for collecting and installing addons in [Zotero7+](https://www.zotero.org).

## Install

1. Download the [latest release](https://github.com/syt2/zotero-tldr/releases/latest/download/zotero-addons.xpi) xpi file
2. Install in Zotero `(Tools) -> (Add-ons)`

## Usage

click <img align="center" src="addon/chrome/content/icons/favicon.png" width=24/> in Toolbar

## Data source

The main data source for add-ons comes from [zotero-chinese/zotero-plugins](https://github.com/zotero-chinese/zotero-plugins).

If you have new add-ons to add, submit it to [zotero-chinese/zotero-plugins](https://github.com/zotero-chinese/zotero-plugins).

## Develop

### Custom Data Source

A custom scheme
`zotero://zoteroaddoncollection/configSource?source=source-custom&customURL={encodeURIComponent(SOME URL)}`
can change add-on data source automatically to a custom url.

A custom scheme
`zotero://zoteroaddoncollection/install?source={encodeURIComponent(SOME URL)}`
can install add-on from the custom url.

## Star History

<a href="https://star-history.com/#syt2/zotero-addons&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=syt2/zotero-addons&type=Date&theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=syt2/zotero-addons&type=Date" />
    <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=syt2/zotero-addons&type=Date" />
  </picture>
</a>
