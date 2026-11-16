import type { KrunkerClient } from "../../client.js";
import * as check from "../../validate.js";
import { unwrapApp } from "../envelope.js";
import type { AppPageQuery } from "../envelope.js";
import type { AppCurrency, AppItem, AppPage, AppReply } from "../types.js";

// ========================= //
// = Copyright (c) NullDev = //
// =     - SPDX: MIT -     = //
// ========================= //

const MAX_LIMIT = 100;

/** the player's items and balances; scope `inventory:read` */
export class AppInventoryApi {
    readonly #gapi: KrunkerClient;
    readonly #auth: Record<string, string>;

    constructor(gapi: KrunkerClient, auth: Record<string, string>){
        this.#gapi = gapi;
        this.#auth = auth;
    }

    /** GET /app/v1/inventory/items (inventory:read), what the in-game inventory shows; copies listed on the market are left out */
    items(query: AppPageQuery = {}): Promise<AppPage<AppItem>> {
        return this.#gapi.get<AppPage<AppItem>>("/app/v1/inventory/items", {
            route: "app.inventory.items",
            headers: this.#auth,
            query: {
                cursor: query.cursor,
                limit: check.optionalInt(query.limit, "limit", 1, MAX_LIMIT),
            },
        });
    }

    /** GET /app/v1/inventory/currencies (inventory:read), the balances; KR and Junk always, others only when held */
    currencies(): Promise<AppCurrency[]> {
        return unwrapApp(this.#gapi.get<AppReply<AppCurrency[]>>("/app/v1/inventory/currencies", { route: "app.inventory.currencies", headers: this.#auth }));
    }
}
