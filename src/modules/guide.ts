
import { getPref, setPref } from "../utils/prefs";
import { version } from "../../package.json";
import { getString } from "../utils/locale";
import { AddonTable } from "./addonTable";


export enum GuideStatus {
  openAddonTable = 1,
  switchDataSourceHint = 2,
  // next = 4,
};

export class Guide {
  static initPrefs() {
    if (getPref('checkUncompatibleAddonsIn' + "7")) {
      setPref('firstInstalledVersion', '1.0.0');
    } else if (!getPref('firstInstalledVersion')) {
      setPref('firstInstalledVersion', version);
    }

  }

  static showGuideInMainWindowIfNeed(win: Window) {
    if (!this.checkNeedGuide(GuideStatus.openAddonTable)) { return; }
    const guide = new ztoolkit.Guide();
    guide.addStep({
      title: getString('guide-open-addons-table-title'),
      description: getString('guide-open-addons-table-message'),
      element: win.document.querySelector('#zotero-toolbaritem-addons')!,
      showButtons: ["close"],
      closeBtnText: getString('guide-guide-done'),
      position: "after_end",
      onCloseClick: () => {
        AddonTable.showAddonsWindow();
      },
    })
    .show(win.document);
    setPref('guideStatus', ((getPref('guideStatus') ?? 0) as number) | GuideStatus.openAddonTable);
  }

  static showGuideInAddonTableIfNeed(win: Window) {
    if (!this.checkNeedGuide(GuideStatus.switchDataSourceHint)) { return; }
    const guide = new ztoolkit.Guide();
    guide.addStep({
      title: getString('guide-addons-table-switch-source-title'),
      description: getString('guide-addons-table-switch-source-message'),
      element: win.document.querySelector('#sources')!,
      position: "before_start",
    })
    .show(win.document);
    setPref('guideStatus', ((getPref('guideStatus') ?? 0) as number) | GuideStatus.switchDataSourceHint);
  }

  private static checkNeedGuide(guideStatus: GuideStatus) {
    const firstInstalledVersion = getPref('firstInstalledVersion') as string;
    if (!firstInstalledVersion) { return false; }
    if (Services.vc.compare(firstInstalledVersion, version) < 0) { return false; }
    const alreadyGuideStatus = getPref('guideStatus') as number;
    if (alreadyGuideStatus & guideStatus) { return false; }
    return true;
  }
}