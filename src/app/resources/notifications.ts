import type { KrunkerClient } from "../../client.js";
import * as check from "../../validate.js";
import { unwrapApp } from "../envelope.js";
import type { AppPageQuery } from "../envelope.js";
import type { AppNotification, AppNotificationCount, AppPage, AppReply } from "../types.js";

// ========================= //
// = Copyright (c) NullDev = //
// =     - SPDX: MIT -     = //
// ========================= //

const MAX_LIMIT = 100;

/** filters of GET /app/v1/notifications */
export type AppNotificationsQuery = AppPageQuery & {
    /** only unread mail */
    unread?: boolean;
};

/** the player's Krunker Mail; scope `notifications:read`. reading here never marks mail as read */
export class AppNotificationsApi {
    readonly #gapi: KrunkerClient;
    readonly #auth: Record<string, string>;

    constructor(gapi: KrunkerClient, auth: Record<string, string>){
        this.#gapi = gapi;
        this.#auth = auth;
    }

    /** GET /app/v1/notifications (notifications:read), the player's Krunker Mail, newest first */
    list(query: AppNotificationsQuery = {}): Promise<AppPage<AppNotification>> {
        return this.#gapi.get<AppPage<AppNotification>>("/app/v1/notifications", {
            route: "app.notifications.list",
            headers: this.#auth,
            query: {
                unread: query.unread ? "true" : undefined,
                cursor: query.cursor,
                limit: check.optionalInt(query.limit, "limit", 1, MAX_LIMIT),
            },
        });
    }

    /** GET /app/v1/notifications/count (notifications:read), how much mail is unread */
    count(): Promise<AppNotificationCount> {
        return unwrapApp(this.#gapi.get<AppReply<AppNotificationCount>>("/app/v1/notifications/count", { route: "app.notifications.count", headers: this.#auth }));
    }
}
