import type { KrunkerClient } from "../../client.js";
import * as check from "../../validate.js";
import type { AppPageQuery } from "../envelope.js";
import type { AppMap, AppPage } from "../types.js";

// ========================= //
// = Copyright (c) NullDev = //
// =     - SPDX: MIT -     = //
// ========================= //

const MAX_LIMIT = 100;

/** the player's published maps; scope `maps:read` */
export class AppMapsApi {
    readonly #gapi: KrunkerClient;
    readonly #auth: Record<string, string>;

    constructor(gapi: KrunkerClient, auth: Record<string, string>){
        this.#gapi = gapi;
        this.#auth = auth;
    }

    /** GET /app/v1/maps (maps:read), the player's published maps with their stats, newest first */
    list(query: AppPageQuery = {}): Promise<AppPage<AppMap>> {
        return this.#gapi.get<AppPage<AppMap>>("/app/v1/maps", {
            route: "app.maps.list",
            headers: this.#auth,
            query: {
                cursor: query.cursor,
                limit: check.optionalInt(query.limit, "limit", 1, MAX_LIMIT),
            },
        });
    }
}
