import { KrunkerClient, type ClientOptions } from "../client.js";
import { KrunkerTokenError } from "../errors.js";
import { GAPI_URL } from "../game/envelope.js";
import { bearer } from "../jwt.js";
import type { RateLimitState } from "../rateLimit.js";
import { AppActionsApi } from "./resources/actions.js";
import { AppClanApi } from "./resources/clan.js";
import { AppDmsApi } from "./resources/dms.js";
import { AppFriendsApi } from "./resources/friends.js";
import { AppInventoryApi } from "./resources/inventory.js";
import { AppMapsApi } from "./resources/maps.js";
import { AppMarketApi } from "./resources/market.js";
import { AppNotificationsApi } from "./resources/notifications.js";
import { AppPlayerApi } from "./resources/player.js";
import { AppStatsApi } from "./resources/stats.js";
import { AppTradesApi } from "./resources/trades.js";

// ========================= //
// = Copyright (c) NullDev = //
// =     - SPDX: MIT -     = //
// ========================= //

export type { AppPageQuery } from "./envelope.js";
export type { AppChallengesQuery } from "./resources/stats.js";
export type { AppTradesQuery } from "./resources/trades.js";
export type { AppNotificationsQuery } from "./resources/notifications.js";
export * from "./oauth.js";

/** options of the app tier: everything of ClientOptions but the key, the access token replaces it */
export type AppApiOptions = Omit<ClientOptions, "apiKey" | "baseUrl">;

/**
 * the app api bound to one player's access token; made by Krunker.app(accessToken).
 * each endpoint needs its scope on the token, a missing one is a KrunkerForbiddenError with the code `insufficient_scope`
 */
export class AppSession {
    /** `profile`, on every token */
    readonly player: AppPlayerApi;
    /** needs `stats:read` */
    readonly stats: AppStatsApi;
    /** needs `inventory:read` */
    readonly inventory: AppInventoryApi;
    /** needs `trades:read` */
    readonly trades: AppTradesApi;
    /** needs `market:read` */
    readonly market: AppMarketApi;
    /** needs `friends:read` */
    readonly friends: AppFriendsApi;
    /** needs `maps:read` */
    readonly maps: AppMapsApi;
    /** needs `clan:read` */
    readonly clan: AppClanApi;
    /** needs `notifications:read` */
    readonly notifications: AppNotificationsApi;
    /** needs `dms:read` */
    readonly dms: AppDmsApi;
    /** the outcome of a per-action approval */
    readonly actions: AppActionsApi;
    readonly #client: KrunkerClient;

    constructor(client: KrunkerClient, accessToken: string){
        const auth = bearer(accessToken);
        this.#client = client;
        this.player = new AppPlayerApi(client, auth);
        this.stats = new AppStatsApi(client, auth);
        this.inventory = new AppInventoryApi(client, auth);
        this.trades = new AppTradesApi(client, auth);
        this.market = new AppMarketApi(client, auth);
        this.friends = new AppFriendsApi(client, auth);
        this.maps = new AppMapsApi(client, auth);
        this.clan = new AppClanApi(client, auth);
        this.notifications = new AppNotificationsApi(client, auth);
        this.dms = new AppDmsApi(client, auth);
        this.actions = new AppActionsApi(client, auth);
    }

    /** what the last replies said about this player's windows */
    rateLimit(): RateLimitState {
        return this.#client.rateLimit.snapshot();
    }
}

/**
 * the reads of Login with Krunker's app api (gapi.svc.krunker.io/app/v1) with an access token an oauth sign-in gave out.
 * the token is only ever sent as a bearer header, never stored or logged; every write of the app api is left out on purpose
 */
export class KrunkerAppApi {
    readonly #options: AppApiOptions;

    constructor(options: AppApiOptions = {}){
        this.#options = options;
    }

    /**
     * the resources bound to one access token (`kat_...`); throws KrunkerTokenError before any request when it is empty.
     * the token is opaque and lives an hour, so a session is made per token: refresh with KrunkerOAuth and make a new one.
     * every session tracks its own rate limit windows, the app api counts them per app and player
     */
    as(accessToken: string): AppSession {
        if (typeof accessToken !== "string" || accessToken.trim().length === 0) throw new KrunkerTokenError("access token is empty");
        return new AppSession(new KrunkerClient({ ...this.#options, baseUrl: GAPI_URL }), accessToken);
    }
}
