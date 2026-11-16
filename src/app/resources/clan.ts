import type { KrunkerClient } from "../../client.js";
import * as check from "../../validate.js";
import { unwrapApp } from "../envelope.js";
import type { AppPageQuery } from "../envelope.js";
import type { AppClanMember, AppClanMembership, AppPage, AppPlayerRef, AppReply } from "../types.js";

// ========================= //
// = Copyright (c) NullDev = //
// =     - SPDX: MIT -     = //
// ========================= //

const MAX_LIMIT = 100;

/** the player's clan, its members and join applications; scope `clan:read` */
export class AppClanApi {
    readonly #gapi: KrunkerClient;
    readonly #auth: Record<string, string>;

    constructor(gapi: KrunkerClient, auth: Record<string, string>){
        this.#gapi = gapi;
        this.#auth = auth;
    }

    /** GET /app/v1/clan (clan:read), the player's clan and role; `clan` is null without one */
    get(): Promise<AppClanMembership> {
        return unwrapApp(this.#gapi.get<AppReply<AppClanMembership>>("/app/v1/clan", { route: "app.clan.get", headers: this.#auth }));
    }

    /** GET /app/v1/clan/members (clan:read), the members of the player's clan; a 404 without a clan */
    members(query: AppPageQuery = {}): Promise<AppPage<AppClanMember>> {
        return this.#gapi.get<AppPage<AppClanMember>>("/app/v1/clan/members", {
            route: "app.clan.members",
            headers: this.#auth,
            query: {
                cursor: query.cursor,
                limit: check.optionalInt(query.limit, "limit", 1, MAX_LIMIT),
            },
        });
    }

    /** GET /app/v1/clan/applications (clan:read), pending join requests, oldest first; officers only, a 403 `not_clan_officer` otherwise */
    applications(query: AppPageQuery = {}): Promise<AppPage<AppPlayerRef>> {
        return this.#gapi.get<AppPage<AppPlayerRef>>("/app/v1/clan/applications", {
            route: "app.clan.applications",
            headers: this.#auth,
            query: {
                cursor: query.cursor,
                limit: check.optionalInt(query.limit, "limit", 1, MAX_LIMIT),
            },
        });
    }
}
