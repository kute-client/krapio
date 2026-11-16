import type { KrunkerClient } from "../../client.js";
import * as check from "../../validate.js";
import { unwrapApp } from "../envelope.js";
import type { AppAction, AppReply } from "../types.js";

// ========================= //
// = Copyright (c) NullDev = //
// =     - SPDX: MIT -     = //
// ========================= //

/** the outcome of a per-action approval; any valid token of the same player and app, no scope of its own */
export class AppActionsApi {
    readonly #gapi: KrunkerClient;
    readonly #auth: Record<string, string>;

    constructor(gapi: KrunkerClient, auth: Record<string, string>){
        this.#gapi = gapi;
        this.#auth = auth;
    }

    /** GET /app/v1/actions/:action_id, where a per-action approval stands and, once it ran, what the call answered */
    get(actionId: string): Promise<AppAction> {
        return unwrapApp(this.#gapi.get<AppReply<AppAction>>(`/app/v1/actions/${check.opaque(actionId, "action_id")}`, { route: "app.actions.get", headers: this.#auth }));
    }
}
