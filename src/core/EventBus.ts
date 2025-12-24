/**
 * Event Bus using mitt for decoupled communication between modules
 */

import mitt, { Emitter } from "mitt";

/**
 * Pre-defined addon events
 */
export const AddonEvents = {
  /** Addon state changed (installed, uninstalled, enabled, disabled, etc.) */
  ADDON_CHANGED: "addon:changed",
  /** UI refresh required */
  REFRESH_REQUIRED: "ui:refresh",
  /** Source changed */
  SOURCE_CHANGED: "source:changed",
  /** Data fetched */
  DATA_FETCHED: "data:fetched",
} as const;

/**
 * Event map for addon events
 */
export type AddonEventMap = {
  [AddonEvents.ADDON_CHANGED]: void;
  [AddonEvents.REFRESH_REQUIRED]: void;
  [AddonEvents.SOURCE_CHANGED]: { sourceId: string };
  [AddonEvents.DATA_FETCHED]: { count: number };
};

// Singleton emitter instance
let emitter: Emitter<AddonEventMap> | null = null;

/**
 * Get the event bus instance
 */
export function getEventBus(): Emitter<AddonEventMap> {
  if (!emitter) {
    emitter = mitt<AddonEventMap>();
  }
  return emitter;
}

/**
 * Clear all event handlers (for cleanup on shutdown)
 */
export function clearEventBus(): void {
  emitter?.all.clear();
}
