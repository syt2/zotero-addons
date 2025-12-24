/**
 * Event Bus for decoupled communication between modules
 */

type EventHandler<T = void> = (data: T) => void;

/**
 * Generic event bus implementation
 */
export class EventBus<
  EventMap extends Record<string, unknown> = Record<string, unknown>,
> {
  private static instance: EventBus;
  private handlers: Map<keyof EventMap, Set<EventHandler<unknown>>> = new Map();

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance<
    T extends Record<string, unknown> = Record<string, unknown>,
  >(): EventBus<T> {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance as EventBus<T>;
  }

  /**
   * Subscribe to an event
   * @param event Event name
   * @param handler Event handler
   * @returns Unsubscribe function
   */
  on<K extends keyof EventMap>(
    event: K,
    handler: EventHandler<EventMap[K]>,
  ): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler as EventHandler<unknown>);

    // Return unsubscribe function
    return () => this.off(event, handler);
  }

  /**
   * Subscribe to an event once
   * @param event Event name
   * @param handler Event handler
   */
  once<K extends keyof EventMap>(
    event: K,
    handler: EventHandler<EventMap[K]>,
  ): void {
    const onceHandler: EventHandler<EventMap[K]> = (data) => {
      this.off(event, onceHandler);
      handler(data);
    };
    this.on(event, onceHandler);
  }

  /**
   * Unsubscribe from an event
   * @param event Event name
   * @param handler Event handler
   */
  off<K extends keyof EventMap>(
    event: K,
    handler: EventHandler<EventMap[K]>,
  ): void {
    this.handlers.get(event)?.delete(handler as EventHandler<unknown>);
  }

  /**
   * Emit an event
   * @param event Event name
   * @param data Event data
   */
  emit<K extends keyof EventMap>(event: K, data?: EventMap[K]): void {
    this.handlers.get(event)?.forEach((handler) => {
      try {
        handler(data);
      } catch (error) {
        ztoolkit.log(
          `EventBus: Error in handler for ${String(event)}: ${error}`,
        );
      }
    });
  }

  /**
   * Remove all handlers for an event
   * @param event Event name
   */
  clear<K extends keyof EventMap>(event: K): void {
    this.handlers.delete(event);
  }

  /**
   * Remove all handlers for all events
   */
  clearAll(): void {
    this.handlers.clear();
  }
}

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
  [key: string]: unknown;
};

/**
 * Get typed event bus instance
 */
export function getEventBus(): EventBus<AddonEventMap> {
  return EventBus.getInstance<AddonEventMap>();
}
