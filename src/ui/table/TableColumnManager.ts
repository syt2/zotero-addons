/**
 * Table column manager
 * Handles column configuration and persistence
 */

import { LargePrefHelper } from "zotero-plugin-toolkit";
import { config } from "../../../package.json";
import { getString } from "../../utils/locale";
import type { ExtendedColumnOptions } from "../../types";

export class TableColumnManager {
  private largePrefHelper = new LargePrefHelper(
    "zotero.addons.ui",
    config.prefsPrefix,
    "parser",
  );
  private _columns: ExtendedColumnOptions[] = [];

  /**
   * Get column configurations
   */
  get columns(): ExtendedColumnOptions[] {
    if (this._columns.length > 0) {
      return this._columns;
    }
    const defaultColumns = this.getDefaultColumns();
    this._columns = defaultColumns;
    try {
      const result = this.largePrefHelper.getValue(
        "columns",
      ) as ExtendedColumnOptions[];
      if (result.length === this._columns.length) {
        this._columns = result;
      }
    } catch {
      // Use default columns
    }
    this._columns.map((column) =>
      // @ts-expect-error ignore getString type check
      Object.assign(column, { label: getString(column.dataKey) }),
    );
    return this._columns;
  }

  /**
   * Get sorted columns for display
   */
  getSortedColumns(): ExtendedColumnOptions[] {
    return this.columns
      .slice()
      .sort((a, b) => ((a as any).ordinal ?? 0) - ((b as any).ordinal ?? 0));
  }

  /**
   * Update columns from tree instance
   */
  updateColumns(treeInstance: any): void {
    try {
      this._columns = treeInstance?._getColumns() as ExtendedColumnOptions[];
      if (this._columns.length > 0) {
        this._columns = this._columns.map((column: any) => {
          const {
            ["className"]: _removedClassNameAttr,
            ...newObjWithoutClassName
          } = column;
          return newObjWithoutClassName;
        });
        this.largePrefHelper.setValue("columns", this._columns);
      }
    } catch (error) {
      ztoolkit.log(`updateColumns failed: ${error}`);
    }
  }

  /**
   * Get column with sort direction if any
   */
  getSortColumn(): ExtendedColumnOptions | undefined {
    return this.columns.find((column) => "sortDirection" in column);
  }

  /**
   * Clear sort direction from column
   */
  clearSortDirection(columnIndex: number, treeInstance: any): void {
    const columns = treeInstance?._getColumns();
    if (columns && columns[columnIndex]) {
      const column = columns[columnIndex];
      // Disable sort for these columns
      if (
        ["menu-desc", "menu-remote-version", "menu-local-version"].includes(
          column.dataKey,
        )
      ) {
        delete treeInstance?._columns?._columns[columnIndex]?.sortDirection;
      }
    }
  }

  /**
   * Get default column configurations
   */
  private getDefaultColumns(): ExtendedColumnOptions[] {
    return [
      {
        dataKey: "menu-name",
        label: "menu-name",
        staticWidth: true,
        hidden: false,
      },
      {
        dataKey: "menu-desc",
        label: "menu-desc",
        fixedWidth: false,
        hidden: false,
      },
      {
        dataKey: "menu-star",
        label: "menu-star",
        staticWidth: true,
        width: 50,
        hidden: false,
      },
      {
        dataKey: "menu-remote-update-time",
        label: "menu-remote-update-time",
        staticWidth: true,
        width: 150,
        hidden: false,
      },
      {
        dataKey: "menu-remote-version",
        label: "menu-remote-version",
        staticWidth: true,
        width: 100,
        hidden: false,
      },
      {
        dataKey: "menu-local-version",
        label: "menu-local-version",
        staticWidth: true,
        width: 85,
        hidden: false,
      },
      {
        dataKey: "menu-install-state",
        label: "menu-install-state",
        staticWidth: true,
        width: 95,
        hidden: false,
      },
    ];
  }

  /**
   * Replace column selection menu
   */
  replaceColumnSelectMenu(oldNode: Element, treeInstance: any): void {
    const columns = this.getSortedColumns();
    const allColumnSelectMenus = columns
      .filter((c) => c.dataKey !== "menu-name")
      .map((c) => c.dataKey);

    ztoolkit.UI.replaceElement(
      {
        tag: "menupopup",
        id: "listColumnMenu",
        listeners: [
          {
            type: "command",
            listener: async (ev) => {
              const selectValue = (ev.target as any).getAttribute("value");
              const idx = treeInstance
                ._getColumns()
                .findIndex((c: any) => c.dataKey === selectValue);
              if (idx >= 0) {
                treeInstance._columns.toggleHidden(idx);
              }
            },
          },
        ],
        children: allColumnSelectMenus.map((menuItem) => ({
          tag: "menuitem",
          attributes: {
            // @ts-expect-error ignore getString type check
            label: getString(menuItem),
            value: menuItem,
            checked: !(
              this.columns.find((column) => column.dataKey === menuItem) as any
            )?.hidden,
          },
        })),
      },
      oldNode,
    );
  }
}
