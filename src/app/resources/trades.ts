import type { KrunkerClient } from "../../client.js";
import * as check from "../../validate.js";
import { unwrapApp } from "../envelope.js";
import type { AppPageQuery } from "../envelope.js";
import type { AppPage, AppReply, AppTrade, AppTradeCount } from "../types.js";

// ========================= //
// = Copyright (c) NullDev = //
// =     - SPDX: MIT -     = //
// ========================= //

const MAX_LIMIT = 100;

const TRADE_STATUS = ["open", "completed"] as const;

/** filters of GET /app/v1/trades */
export type AppTradesQuery = AppPageQuery & {
    /** open when omitted */
    status?: "open" | "completed";
};

/** the player's trades; scope `trades:read`. creating, accepting and cancelling are writes and stay out */
export class AppTradesApi {
    readonly #gapi: KrunkerClient;
    readonly #auth: Record<string, string>;

    constructor(gapi: KrunkerClient, auth: Record<string, string>){
        this.#gapi = gapi;
        this.#auth = auth;
    }

    /** GET /app/v1/trades (trades:read), open trades in both directions, or completed ones newest first */
    list(query: AppTradesQuery = {}): Promise<AppPage<AppTrade>> {
        return this.#gapi.get<AppPage<AppTrade>>("/app/v1/trades", {
            route: "app.trades.list",
            headers: this.#auth,
            query: {
                status: check.oneOf(query.status, TRADE_STATUS, "status"),
                cursor: query.cursor,
                limit: check.optionalInt(query.limit, "limit", 1, MAX_LIMIT),
            },
        });
    }

    /** GET /app/v1/trades/count (trades:read), how many trades are open and completed */
    count(): Promise<AppTradeCount> {
        return unwrapApp(this.#gapi.get<AppReply<AppTradeCount>>("/app/v1/trades/count", { route: "app.trades.count", headers: this.#auth }));
    }
}
