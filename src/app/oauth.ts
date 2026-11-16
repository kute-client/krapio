import { KrunkerClient, type ClientOptions } from "../client.js";
import { KrunkerArgumentError, KrunkerConfigError, KrunkerError } from "../errors.js";
import { GAPI_URL } from "../game/envelope.js";
import type { AppScope, OAuthCallbackError, OAuthDiscovery, OAuthTokens } from "./types.js";

// ========================= //
// = Copyright (c) NullDev = //
// =     - SPDX: MIT -     = //
// ========================= //

/** krunker.io/oauth/authorize, where the player signs in and consents; also where a per-action approval is shown */
export const OAUTH_AUTHORIZE_URL = "https://krunker.io/oauth/authorize";

const MAX_STATE = 500;
const VERIFIER = /^[A-Za-z0-9\-._~]{43,128}$/;

/** the credentials of an app registered under Developer > Applications */
export type AppCredentials = {
    /** `kapp_...`, public */
    clientId: string;
    /** `kas_...`, confidential clients only; leave it out for a public client, which sends none */
    clientSecret?: string;
    /** one of the app's registered redirect uris, character for character; the default of authorizeUrl and exchangeCode */
    redirectUri?: string;
};

/** options of KrunkerOAuth: the app's credentials plus everything of ClientOptions but the key and the host */
export type OAuthOptions = AppCredentials & Omit<ClientOptions, "apiKey" | "baseUrl">;

/** a code verifier and its S256 challenge; keep the verifier server side, only the challenge goes in the url */
export type Pkce = {
    verifier: string;
    challenge: string;
    method: "S256";
};

/** what authorizeUrl puts in the query */
export type AuthorizeQuery = {
    /** `profile` is always added by Krunker; anything not approved for the app is refused with `invalid_scope` */
    scope: readonly AppScope[];
    /** your random value, tied to the visitor's session; 1 to 500 characters */
    state: string;
    /** `challenge` of createPkce */
    codeChallenge: string;
    /** when it differs from the one the instance was made with */
    redirectUri?: string;
};

/** what exchangeCode takes: the `code` of the redirect and the verifier of the same sign-in attempt */
export type CodeExchange = {
    code: string;
    codeVerifier: string;
    /** the same redirect uri the authorize request carried */
    redirectUri?: string;
};

/** a redirect back that carried `error` instead of `code`, or whose `state` is not the one that was sent */
export class KrunkerOAuthError extends KrunkerError {
    /** `access_denied` when the player declined, `state_mismatch` when the state is not yours */
    readonly error: OAuthCallbackError | "state_mismatch";

    constructor(error: OAuthCallbackError | "state_mismatch", description?: string){
        super(description ? `Krunker OAuth ${error}: ${description}` : `Krunker OAuth ${error}`);
        this.error = error;
    }
}

/** what the redirect back says: a sign-in to exchange, or the outcome hint of a per-action approval */
export type OAuthCallback =
    | { kind: "code"; code: string }
    | { kind: "action"; actionId: string; status: "approved" | "denied" | "failed" | (string & {}) };

const base64Url = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const randomBase64Url = (bytes: number): string => base64Url(crypto.getRandomValues(new Uint8Array(bytes)));

/** a random `state` for one sign-in attempt or one approval request, 22 characters */
export const createState = (): string => randomBase64Url(16);

/** a fresh PKCE pair for one sign-in attempt: 32 random bytes as the verifier, base64url(sha256(verifier)) as the challenge */
export async function createPkce(): Promise<Pkce> {
    const verifier = randomBase64Url(32);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    return { verifier, challenge: base64Url(new Uint8Array(digest)), method: "S256" };
}

/**
 * reads the query of a redirect back to your redirect uri and checks `state` before anything else.
 * throws KrunkerOAuthError when the state is not `expectedState` or the redirect carries an `error`;
 * the `status` of an approval is a hint only, read the outcome with `actions.get(actionId)`
 */
export function parseCallback(url: string | URL | URLSearchParams, expectedState: string): OAuthCallback {
    let params: URLSearchParams;
    if (url instanceof URLSearchParams) params = url;
    else params = new URL(url, "http://localhost").searchParams;

    const state = params.get("state");
    if (typeof expectedState !== "string" || expectedState.length === 0 || state !== expectedState) throw new KrunkerOAuthError("state_mismatch", "the state of the redirect is not the one that was sent");
    const error = params.get("error");
    if (error) throw new KrunkerOAuthError(error, params.get("error_description") ?? undefined);
    const actionId = params.get("action_id");
    if (actionId) return { kind: "action", actionId, status: params.get("status") ?? "" };
    const code = params.get("code");
    if (!code) throw new KrunkerOAuthError("invalid_request", "the redirect carries neither a code nor an action_id");
    return { kind: "code", code };
}

/**
 * Login with Krunker: OAuth 2.0 authorization code flow with PKCE (S256), refresh token rotation and revocation.
 * nothing is stored here, the verifier, the state and the tokens are yours to keep; the token calls are sent once and
 * never retried, since a code and a refresh token are both spent by the first attempt
 */
export class KrunkerOAuth {
    readonly #client: KrunkerClient;
    readonly #credentials: AppCredentials;

    constructor(options: Partial<OAuthOptions> = {}){
        const { clientId, clientSecret, redirectUri, ...shared } = options;
        this.#credentials = { clientId: clientId ?? "", clientSecret, redirectUri };
        this.#client = new KrunkerClient({ ...shared, baseUrl: GAPI_URL });
    }

    /** false without a client id, every call but discovery throws KrunkerConfigError then */
    get configured(): boolean {
        return this.#credentials.clientId.length > 0;
    }

    /** true when no secret was given: a public client, read scopes only, authenticated by PKCE alone */
    get isPublic(): boolean {
        return !this.#credentials.clientSecret;
    }

    /** GET /.well-known/oauth-authorization-server, the endpoints and scopes as the server lists them (RFC 8414) */
    discovery(): Promise<OAuthDiscovery> {
        return this.#client.get<OAuthDiscovery>("/.well-known/oauth-authorization-server", { route: "oauth.discovery" });
    }

    /** the consent page url to redirect the player to; nothing is sent */
    authorizeUrl(query: AuthorizeQuery): string {
        if (typeof query.state !== "string" || query.state.length === 0 || query.state.length > MAX_STATE) throw new KrunkerArgumentError(`state must be 1 to ${MAX_STATE} characters`);
        if (typeof query.codeChallenge !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(query.codeChallenge)) throw new KrunkerArgumentError("codeChallenge must be the 43 character S256 challenge");
        const url = new URL(OAUTH_AUTHORIZE_URL);
        url.search = new URLSearchParams({
            response_type: "code",
            client_id: this.#clientId(),
            redirect_uri: this.#redirectUri(query.redirectUri),
            scope: [...new Set(query.scope)].join(" ") || "profile",
            state: query.state,
            code_challenge: query.codeChallenge,
            code_challenge_method: "S256",
        }).toString();
        return url.toString();
    }

    /** POST /oauth/token with grant_type=authorization_code; the code is good for 60 seconds and one attempt, failed or not */
    exchangeCode(exchange: CodeExchange): Promise<OAuthTokens> {
        if (typeof exchange.code !== "string" || exchange.code.length === 0) throw new KrunkerArgumentError("code must be a non-empty string");
        if (typeof exchange.codeVerifier !== "string" || !VERIFIER.test(exchange.codeVerifier)) throw new KrunkerArgumentError("codeVerifier must be 43 to 128 characters of A-Z a-z 0-9 - . _ ~");
        return this.#post("/oauth/token", "oauth.token", {
            grant_type: "authorization_code",
            code: exchange.code,
            redirect_uri: this.#redirectUri(exchange.redirectUri),
            code_verifier: exchange.codeVerifier,
        });
    }

    /**
     * POST /oauth/token with grant_type=refresh_token. the reply carries a new refresh token and the old one is spent:
     * store the new one right away and never refresh the same player's tokens concurrently, a second use of a
     * refresh token revokes the whole sign-in
     */
    refresh(refreshToken: string): Promise<OAuthTokens> {
        if (typeof refreshToken !== "string" || refreshToken.length === 0) throw new KrunkerArgumentError("refreshToken must be a non-empty string");
        return this.#post("/oauth/token", "oauth.token", { grant_type: "refresh_token", refresh_token: refreshToken });
    }

    /**
     * POST /oauth/revoke (RFC 7009): a refresh token takes its whole chain with it, an access token only itself.
     * answers 200 for any token, valid or not; the app stays connected for the player
     */
    async revoke(token: string): Promise<void> {
        if (typeof token !== "string" || token.length === 0) throw new KrunkerArgumentError("token must be a non-empty string");
        await this.#post<unknown>("/oauth/revoke", "oauth.revoke", { token });
    }

    #clientId(): string {
        if (!this.configured) throw new KrunkerConfigError("Login with Krunker needs the app's clientId, none was given");
        return this.#credentials.clientId;
    }

    #redirectUri(override?: string): string {
        const uri = override ?? this.#credentials.redirectUri;
        if (typeof uri !== "string" || uri.length === 0) throw new KrunkerArgumentError("redirectUri is missing, pass it or set it on the app credentials");
        return uri;
    }

    /** a confidential client authenticates with http basic, a public one sends its id in the body and no secret */
    #post<T>(path: string, route: string, form: Record<string, string>): Promise<T> {
        const clientId = this.#clientId();
        const { clientSecret } = this.#credentials;
        if (!clientSecret) return this.#client.postForm<T>(path, { route, form: { ...form, client_id: clientId } });
        const basic = btoa(`${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`);
        return this.#client.postForm<T>(path, { route, form, headers: { Authorization: `Basic ${basic}` } });
    }
}
