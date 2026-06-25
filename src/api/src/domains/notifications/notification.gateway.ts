import { Injectable, Logger } from "@nestjs/common";
import type { NotificationResponse } from "./types.js";

/**
 * WebSocket push surface for in-app notifications.
 * Uses an in-process event bus so integration tests can subscribe without a live socket server.
 * Production clients connect via Socket.IO namespace `/notifications` when enabled.
 */
@Injectable()
export class NotificationGateway {
  private readonly logger = new Logger(NotificationGateway.name);
  private readonly listeners = new Map<string, Set<(payload: NotificationResponse) => void>>();

  emitNotificationCreated(userId: string, payload: NotificationResponse): void {
    const subs = this.listeners.get(userId);
    if (subs) {
      for (const fn of subs) {
        fn(payload);
      }
    }
    this.logger.debug(`notification.created → user ${userId}`);
  }

  /** Test helper — subscribe to pushes for a user room. */
  subscribe(userId: string, listener: (payload: NotificationResponse) => void): () => void {
    let subs = this.listeners.get(userId);
    if (!subs) {
      subs = new Set();
      this.listeners.set(userId, subs);
    }
    subs.add(listener);
    return () => subs?.delete(listener);
  }
}
