import type { KrunkerClient } from "../../client.js";
import * as check from "../../validate.js";
import { unwrapApp } from "../envelope.js";
import type { AppMe, AppPlayer, AppReply } from "../types.js";

// ========================= //
// = Copyright (c) NullDev = //
// =     - SPDX: MIT -     = //
// ========================= //

/** the signed-in player and the lookup that turns a name into a subject id; scope `profile`, which every token has */
export class AppPlayerApi {
    readonly #gapi: KrunkerClient;
    readonly #auth: Record<string, string>;

    constructor(gapi: KrunkerClient, auth: Record<string, string>){
        this.#gapi = gapi;
        this.#auth = auth;
    }

    /** GET /app/v1/me (profile), the signed-in player and the scopes this token can use right now; also the userinfo endpoint */
    me(): Promise<AppMe> {
        return this.#gapi.get<AppMe>("/app/v1/me", { route: "app.player.me", headers: this.#auth });
    }

    /** GET /app/v1/players/by-name/:name (profile), any player by name; a banned or hidden account is a 404 */
    byName(name: string): Promise<AppPlayer> {
        return unwrapApp(this.#gapi.get<AppReply<AppPlayer>>(`/app/v1/players/by-name/${check.name(name, "name")}`, { route: "app.player.byName", headers: this.#auth }));
    }
}
