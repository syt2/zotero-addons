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
} as const;

/**
 * Event map for addon events
 */
export type AddonEventMap = {
  [AddonEvents.ADDON_CHANGED]: void;
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
