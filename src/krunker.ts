import type { ClientOptions } from "./client.js";
import { KrunkerAppApi, KrunkerOAuth, type AppCredentials, type AppSession } from "./app/index.js";
import { KrunkerDeveloperApi } from "./developer/index.js";
import { KrunkerGameApi } from "./game/index.js";
import { KrunkerTokenApi, type TokenSession } from "./token/index.js";

// ========================= //
// = Copyright (c) NullDev = //
// =     - SPDX: MIT -     = //
// ========================= //

/** options of Krunker: ClientOptions without baseUrl, every tier picks its own host */
export type KrunkerOptions = Omit<ClientOptions, "baseUrl"> & {
    /** the credentials of a Login with Krunker app, for `krunker.oauth`; `krunker.app(accessToken)` works without them */
    app?: AppCredentials;
};

/**
 * the krunker apis behind one object:
 * - the documented developer api on the root (`krunker.player`, `krunker.market`, ...), needs `apiKey`
 * - `krunker.game.*`, what the game itself reads without any auth
 * - `krunker.as(token).*`, what the game reads with the player's own frvr token
 * - `krunker.oauth.*` and `krunker.app(accessToken).*`, Login with Krunker: the oauth flow and what a player let an app read
 */
export class Krunker extends KrunkerDeveloperApi {
    readonly game: KrunkerGameApi;
    /** Login with Krunker: the consent url, the code exchange, refresh and revoke; needs `app.clientId` */
    readonly oauth: KrunkerOAuth;
    readonly #token: KrunkerTokenApi;
    readonly #app: KrunkerAppApi;

    constructor(options: KrunkerOptions = {}){
        const { app, ...client } = options;
        super(client);
        const { apiKey: _apiKey, ...shared } = client;
        this.game = new KrunkerGameApi(shared);
        this.oauth = new KrunkerOAuth({ ...shared, ...app });
        this.#token = new KrunkerTokenApi(shared);
        this.#app = new KrunkerAppApi(shared);
    }

    /** the endpoints bound to a player's token; throws KrunkerTokenError before any request when it is not a live jwt */
    as(token: string): TokenSession {
        return this.#token.as(token);
    }

    /** the app api bound to an access token of Login with Krunker (`kat_...`); throws KrunkerTokenError when it is empty */
    app(accessToken: string): AppSession {
        return this.#app.as(accessToken);
    }
}
