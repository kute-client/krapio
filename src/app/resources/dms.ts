import type { KrunkerClient } from "../../client.js";
import * as check from "../../validate.js";
import type { AppPageQuery } from "../envelope.js";
import type { AppDmConversation, AppDmThread, AppPage } from "../types.js";

// ========================= //
// = Copyright (c) NullDev = //
// =     - SPDX: MIT -     = //
// ========================= //

/** the dm lists page smaller than the rest: 20 when omitted, 50 at most */
const MAX_LIMIT = 50;

/** direct messages, kept for 30 days; scope `dms:read`. reading here never marks anything read, sending is a write and stays out */
export class AppDmsApi {
    readonly #gapi: KrunkerClient;
    readonly #auth: Record<string, string>;

    constructor(gapi: KrunkerClient, auth: Record<string, string>){
        this.#gapi = gapi;
        this.#auth = auth;
    }

    /** GET /app/v1/dms (dms:read), the player's conversations, newest first */
    conversations(query: AppPageQuery = {}): Promise<AppPage<AppDmConversation>> {
        return this.#gapi.get<AppPage<AppDmConversation>>("/app/v1/dms", {
            route: "app.dms.conversations",
            headers: this.#auth,
            query: {
                cursor: query.cursor,
                limit: check.optionalInt(query.limit, "limit", 1, MAX_LIMIT),
            },
        });
    }

    /** GET /app/v1/dms/:sub (dms:read), the messages with one player, newest first; `peer` sits next to `data` */
    messages(sub: string, query: AppPageQuery = {}): Promise<AppDmThread> {
        return this.#gapi.get<AppDmThread>(`/app/v1/dms/${check.opaque(sub, "sub")}`, {
            route: "app.dms.messages",
            headers: this.#auth,
            query: {
                cursor: query.cursor,
                limit: check.optionalInt(query.limit, "limit", 1, MAX_LIMIT),
            },
        });
    }
}
