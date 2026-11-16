import type { KrunkerClient } from "../../client.js";
import * as check from "../../validate.js";
import { unwrapApp } from "../envelope.js";
import type { AppPageQuery } from "../envelope.js";
import type { AppListing, AppMarketHistoryEntry, AppPage, AppReply } from "../types.js";

// ========================= //
// = Copyright (c) NullDev = //
// =     - SPDX: MIT -     = //
// ========================= //

const MAX_LIMIT = 100;

/** the player's own listings and market history; scope `market:read`. public market data is on the game tier */
export class AppMarketApi {
    readonly #gapi: KrunkerClient;
    readonly #auth: Record<string, string>;

    constructor(gapi: KrunkerClient, auth: Record<string, string>){
        this.#gapi = gapi;
        this.#auth = auth;
    }

    /** GET /app/v1/market/listings (market:read), every active listing of the player; not paged, the game caps them */
    listings(): Promise<AppListing[]> {
        return unwrapApp(this.#gapi.get<AppReply<AppListing[]>>("/app/v1/market/listings", { route: "app.market.listings", headers: this.#auth }));
    }

    /** GET /app/v1/market/history (market:read), completed sales and purchases plus cancelled listings, newest first */
    history(query: AppPageQuery = {}): Promise<AppPage<AppMarketHistoryEntry>> {
        return this.#gapi.get<AppPage<AppMarketHistoryEntry>>("/app/v1/market/history", {
            route: "app.market.history",
            headers: this.#auth,
            query: {
                cursor: query.cursor,
                limit: check.optionalInt(query.limit, "limit", 1, MAX_LIMIT),
            },
        });
    }
}
