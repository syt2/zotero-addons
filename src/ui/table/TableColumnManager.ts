/**
 * Table column manager
 * Handles column configuration and persistence
 */

import { LargePrefHelper } from "zotero-plugin-toolkit";
import { config } from "../../../package.json";
import { getString } from "../../utils/locale";
import { getPref, setPref } from "../../utils/prefs";
import type { ExtendedColumnOptions } from "../../types";

type PersistedColumnState = Pick<
  ExtendedColumnOptions,
  "dataKey" | "hidden" | "ordinal" | "sortDirection" | "width"
>;

const TAG_COLUMN_MIGRATION_PREF = "tagColumnLayoutMigrated";
const TAG_COLUMN_KEY = "menu-tags";
const STAR_COLUMN_KEY = "menu-star";
const TAG_COLUMN_WIDTH = 96;

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
      ) as PersistedColumnState[];
      if (result.length === this._columns.length) {
        const persistedByKey = new Map(
          result.map((column) => [column.dataKey, column]),
        );
        this._columns = defaultColumns.map((column) => ({
          ...column,
          ...persistedByKey.get(column.dataKey),
        }));
      }
    } catch {
      // Use default columns
    }
    this.migrateTagColumnLayoutIfNeeded();
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
        const persistedColumns = this._columns.map((column) =>
          this.toPersistedColumnState(column),
        );
        this.largePrefHelper.setValue("columns", persistedColumns);
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
        ordinal: 0,
      },
      {
        dataKey: "menu-desc",
        label: "menu-desc",
        fixedWidth: false,
        hidden: false,
        ordinal: 1,
      },
      {
        dataKey: "menu-star",
        label: "menu-star",
        staticWidth: true,
        width: 50,
        hidden: false,
        ordinal: 2,
      },
      {
        dataKey: "menu-tags",
        label: "menu-tags",
        staticWidth: true,
        width: 96,
        hidden: true,
        ordinal: 3,
      },
      {
        dataKey: "menu-remote-update-time",
        label: "menu-remote-update-time",
        staticWidth: true,
        width: 150,
        hidden: false,
        ordinal: 4,
      },
      {
        dataKey: "menu-remote-version",
        label: "menu-remote-version",
        staticWidth: true,
        width: 100,
        hidden: false,
        ordinal: 5,
      },
      {
        dataKey: "menu-local-version",
        label: "menu-local-version",
        staticWidth: true,
        width: 85,
        hidden: false,
        ordinal: 6,
      },
      {
        dataKey: "menu-install-state",
        label: "menu-install-state",
        staticWidth: true,
        width: 95,
        hidden: false,
        ordinal: 7,
      },
    ];
  }

  private toPersistedColumnState(
    column: ExtendedColumnOptions,
  ): PersistedColumnState {
    return {
      dataKey: column.dataKey,
      hidden: column.hidden,
      ordinal: column.ordinal,
      sortDirection: column.sortDirection,
      width: column.width,
    };
  }

  private migrateTagColumnLayoutIfNeeded(): void {
    if (getPref(TAG_COLUMN_MIGRATION_PREF)) {
      return;
    }

    const orderedColumns = this._columns
      .slice()
      .sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0));
    const starIndex = orderedColumns.findIndex(
      (column) => column.dataKey === STAR_COLUMN_KEY,
    );
    const starColumn = starIndex >= 0 ? orderedColumns[starIndex] : undefined;
    const tagIndex = orderedColumns.findIndex(
      (column) => column.dataKey === TAG_COLUMN_KEY,
    );
    if (tagIndex < 0) {
      return;
    }

    const [tagColumn] = orderedColumns.splice(tagIndex, 1);
    const insertIndex =
      starColumn && !starColumn.hidden
        ? Math.min(starIndex + 1, orderedColumns.length)
        : orderedColumns.length;
    tagColumn.hidden = false;
    tagColumn.width = TAG_COLUMN_WIDTH;
    orderedColumns.splice(insertIndex, 0, tagColumn);
    orderedColumns.forEach((column, index) => {
      column.ordinal = index;
    });

    this._columns = orderedColumns;
    this.largePrefHelper.setValue(
      "columns",
      this._columns.map((column) => this.toPersistedColumnState(column)),
    );
    setPref(TAG_COLUMN_MIGRATION_PREF, true);
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
