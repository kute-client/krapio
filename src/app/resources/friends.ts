import type { KrunkerClient } from "../../client.js";
import * as check from "../../validate.js";
import type { AppPageQuery } from "../envelope.js";
import type { AppFriend, AppPage } from "../types.js";

// ========================= //
// = Copyright (c) NullDev = //
// =     - SPDX: MIT -     = //
// ========================= //

const MAX_LIMIT = 100;

/** who the player follows and who follows them; scope `friends:read` */
export class AppFriendsApi {
    readonly #gapi: KrunkerClient;
    readonly #auth: Record<string, string>;

    constructor(gapi: KrunkerClient, auth: Record<string, string>){
        this.#gapi = gapi;
        this.#auth = auth;
    }

    /** GET /app/v1/friends/following (friends:read), newest first; banned and hidden accounts are left out */
    following(query: AppPageQuery = {}): Promise<AppPage<AppFriend>> {
        return this.#gapi.get<AppPage<AppFriend>>("/app/v1/friends/following", {
            route: "app.friends.following",
            headers: this.#auth,
            query: {
                cursor: query.cursor,
                limit: check.optionalInt(query.limit, "limit", 1, MAX_LIMIT),
            },
        });
    }

    /** GET /app/v1/friends/followers (friends:read), newest first; banned and hidden accounts are left out */
    followers(query: AppPageQuery = {}): Promise<AppPage<AppFriend>> {
        return this.#gapi.get<AppPage<AppFriend>>("/app/v1/friends/followers", {
            route: "app.friends.followers",
            headers: this.#auth,
            query: {
                cursor: query.cursor,
                limit: check.optionalInt(query.limit, "limit", 1, MAX_LIMIT),
            },
        });
    }
}
