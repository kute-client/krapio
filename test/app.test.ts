import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
    APP_SCOPES,
    AppSession,
    GAPI_URL,
    Krunker,
    KrunkerAppApi,
    KrunkerArgumentError,
    KrunkerBadRequestError,
    KrunkerConfigError,
    KrunkerForbiddenError,
    KrunkerOAuth,
    KrunkerOAuthError,
    KrunkerRateLimitError,
    KrunkerServerError,
    KrunkerTokenError,
    KrunkerUnauthorizedError,
    OAUTH_AUTHORIZE_URL,
    createPkce,
    createState,
    parseCallback,
    type OAuthTokens,
} from "../src/index.js";
import { fakeFetch, ok } from "./fake.js";

const caught = async(run: () => unknown): Promise<unknown> => {
    try {
        await run();
        return null;
    }
    catch (err){
        return err;
    }
};

const tokens: OAuthTokens = {
    access_token: "kat_a",
    token_type: "Bearer",
    expires_in: 3600,
    refresh_token: "krt_r",
    scope: "profile stats:read",
    sub: "0f29b001-eb77-4d21-885f-c121a6511df4",
};

const credentials = { clientId: "kapp_1", clientSecret: "kas_s/1", redirectUri: "https://example.com/callback" };

describe("KrunkerOAuth", () => {
    test("createPkce gives a verifier and its S256 challenge, createState a fresh value", async() => {
        const pkce = await createPkce();
        expect(pkce.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(pkce.challenge).toBe(createHash("sha256").update(pkce.verifier).digest("base64url"));
        expect(pkce.method).toBe("S256");
        expect((await createPkce()).verifier).not.toBe(pkce.verifier);
        expect(createState()).toMatch(/^[A-Za-z0-9_-]{22}$/);
        expect(createState()).not.toBe(createState());
    });

    test("authorizeUrl carries every parameter of the consent page and sends nothing", async() => {
        const fake = fakeFetch([ok({})]);
        const { oauth } = new Krunker({ app: credentials, fetch: fake.fetch });
        const { challenge } = await createPkce();
        const url = new URL(oauth.authorizeUrl({ scope: ["profile", "stats:read", "stats:read"], state: "st", codeChallenge: challenge }));
        expect(url.origin + url.pathname).toBe(OAUTH_AUTHORIZE_URL);
        expect(Object.fromEntries(url.searchParams)).toEqual({
            response_type: "code",
            client_id: "kapp_1",
            redirect_uri: "https://example.com/callback",
            scope: "profile stats:read",
            state: "st",
            code_challenge: challenge,
            code_challenge_method: "S256",
        });
        const other = new URL(oauth.authorizeUrl({ scope: [], state: "st", codeChallenge: challenge, redirectUri: "http://localhost:8787/callback" }));
        expect(other.searchParams.get("scope")).toBe("profile");
        expect(other.searchParams.get("redirect_uri")).toBe("http://localhost:8787/callback");
        expect(fake.calls).toHaveLength(0);
    });

    test("bad arguments and missing credentials are refused before a request", async() => {
        const fake = fakeFetch([ok(tokens)]);
        const oauth = new KrunkerOAuth({ ...credentials, redirectUri: undefined, fetch: fake.fetch });
        const { challenge, verifier } = await createPkce();
        expect(await caught(() => oauth.authorizeUrl({ scope: ["profile"], state: "st", codeChallenge: challenge }))).toBeInstanceOf(KrunkerArgumentError);
        expect(await caught(() => oauth.authorizeUrl({ scope: ["profile"], state: "", codeChallenge: challenge, redirectUri: "https://x.test/cb" }))).toBeInstanceOf(KrunkerArgumentError);
        expect(await caught(() => oauth.authorizeUrl({ scope: ["profile"], state: "s".repeat(501), codeChallenge: challenge, redirectUri: "https://x.test/cb" }))).toBeInstanceOf(KrunkerArgumentError);
        expect(await caught(() => oauth.authorizeUrl({ scope: ["profile"], state: "st", codeChallenge: verifier.slice(1), redirectUri: "https://x.test/cb" }))).toBeInstanceOf(KrunkerArgumentError);
        expect(await caught(() => oauth.exchangeCode({ code: "c", codeVerifier: "short", redirectUri: "https://x.test/cb" }))).toBeInstanceOf(KrunkerArgumentError);
        expect(await caught(() => oauth.exchangeCode({ code: "", codeVerifier: verifier, redirectUri: "https://x.test/cb" }))).toBeInstanceOf(KrunkerArgumentError);
        expect(await caught(() => oauth.refresh(""))).toBeInstanceOf(KrunkerArgumentError);
        expect(await caught(() => oauth.revoke(""))).toBeInstanceOf(KrunkerArgumentError);

        const none = new Krunker({ fetch: fake.fetch }).oauth;
        expect(none.configured).toBe(false);
        expect(await caught(() => none.refresh("krt_r"))).toBeInstanceOf(KrunkerConfigError);
        expect(await caught(() => none.authorizeUrl({ scope: ["profile"], state: "st", codeChallenge: challenge, redirectUri: "https://x.test/cb" }))).toBeInstanceOf(KrunkerConfigError);
        expect(fake.calls).toHaveLength(0);
    });

    test("a confidential client exchanges the code with http basic and a form body", async() => {
        const fake = fakeFetch([ok(tokens, { "Cache-Control": "no-store" })]);
        const oauth = new KrunkerOAuth({ ...credentials, userAgent: "t/1", fetch: fake.fetch });
        const { verifier } = await createPkce();
        expect(oauth.isPublic).toBe(false);
        expect(await oauth.exchangeCode({ code: "x5b", codeVerifier: verifier })).toEqual(tokens);
        const call = fake.calls[0]!;
        expect(call.url).toBe(`${GAPI_URL}/oauth/token`);
        expect(call.method).toBe("POST");
        expect(call.headers).toEqual({
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${btoa("kapp_1:kas_s%2F1")}`,
            "User-Agent": "t/1",
        });
        expect(Object.fromEntries(new URLSearchParams(call.body))).toEqual({
            grant_type: "authorization_code",
            code: "x5b",
            redirect_uri: "https://example.com/callback",
            code_verifier: verifier,
        });
    });

    test("a public client sends its id in the body and no secret", async() => {
        const fake = fakeFetch([ok(tokens)]);
        const oauth = new KrunkerOAuth({ clientId: "kapp_pub", fetch: fake.fetch });
        expect(oauth.isPublic).toBe(true);
        await oauth.refresh("krt_old");
        expect(fake.calls[0]!.headers.Authorization).toBeUndefined();
        expect(Object.fromEntries(new URLSearchParams(fake.calls[0]!.body))).toEqual({ grant_type: "refresh_token", refresh_token: "krt_old", client_id: "kapp_pub" });
    });

    test("revoke posts the token and takes the empty 200", async() => {
        const fake = fakeFetch([{ status: 200 }]);
        const oauth = new KrunkerOAuth({ ...credentials, fetch: fake.fetch });
        expect(await oauth.revoke("krt_r")).toBeUndefined();
        expect(fake.calls[0]!.url).toBe(`${GAPI_URL}/oauth/revoke`);
        expect(fake.calls[0]!.body).toBe("token=krt_r");
    });

    test("a token request is never retried, the first attempt may have spent the token", async() => {
        const down = fakeFetch([{ status: 500, body: { error: "server_error" } }, ok(tokens)]);
        expect(await caught(() => new KrunkerOAuth({ ...credentials, fetch: down.fetch }).refresh("krt_r"))).toBeInstanceOf(KrunkerServerError);
        expect(down.calls).toHaveLength(1);
        const flaky = fakeFetch([new Error("ECONNRESET"), ok(tokens)]);
        await caught(() => new KrunkerOAuth({ ...credentials, fetch: flaky.fetch }).refresh("krt_r"));
        expect(flaky.calls).toHaveLength(1);
    });

    test("the oauth error format reaches the error as code and message", async() => {
        const grant = fakeFetch([{ status: 400, body: { error: "invalid_grant", error_description: "refresh token reused" } }]);
        const err = await caught(() => new KrunkerOAuth({ ...credentials, fetch: grant.fetch }).refresh("krt_r")) as KrunkerBadRequestError;
        expect(err).toBeInstanceOf(KrunkerBadRequestError);
        expect(err.code).toBe("invalid_grant");
        expect(err.message).toContain("invalid_grant: refresh token reused");

        const client = fakeFetch([{ status: 401, body: { error: "invalid_client", error_description: "client authentication failed" } }]);
        const denied = await caught(() => new KrunkerOAuth({ ...credentials, fetch: client.fetch }).revoke("krt_r")) as KrunkerUnauthorizedError;
        expect(denied).toBeInstanceOf(KrunkerUnauthorizedError);
        expect(denied.code).toBe("invalid_client");
    });

    test("discovery needs no credentials", async() => {
        const fake = fakeFetch([ok({ issuer: GAPI_URL, scopes_supported: [...APP_SCOPES] })]);
        const found = await new Krunker({ fetch: fake.fetch }).oauth.discovery();
        expect(found.scopes_supported).toHaveLength(18);
        expect(fake.calls[0]!.url).toBe(`${GAPI_URL}/.well-known/oauth-authorization-server`);
        expect(fake.calls[0]!.method).toBeUndefined();
    });

    test("parseCallback checks the state before anything else", () => {
        expect(parseCallback("https://example.com/callback?code=x5b&state=st", "st")).toEqual({ kind: "code", code: "x5b" });
        expect(parseCallback("/callback?code=x5b&state=st", "st")).toEqual({ kind: "code", code: "x5b" });
        expect(parseCallback(new URLSearchParams("action_id=act_6&state=st&status=approved"), "st")).toEqual({ kind: "action", actionId: "act_6", status: "approved" });

        const mismatch = (run: () => unknown): KrunkerOAuthError => {
            try {
                run();
            }
            catch (err){
                return err as KrunkerOAuthError;
            }
            throw new Error("did not throw");
        };
        expect(mismatch(() => parseCallback("https://example.com/callback?code=x5b&state=other", "st")).error).toBe("state_mismatch");
        expect(mismatch(() => parseCallback("https://example.com/callback?code=x5b", "st")).error).toBe("state_mismatch");
        expect(mismatch(() => parseCallback("https://example.com/callback?code=x5b&state=", "")).error).toBe("state_mismatch");
        // a forged error with the wrong state says nothing about the player
        expect(mismatch(() => parseCallback("https://example.com/callback?error=access_denied&state=other", "st")).error).toBe("state_mismatch");
        const declined = mismatch(() => parseCallback(new URL("https://example.com/callback?error=access_denied&error_description=The+player+denied+the+request.&state=st"), "st"));
        expect(declined).toBeInstanceOf(KrunkerOAuthError);
        expect(declined.error).toBe("access_denied");
        expect(declined.message).toContain("The player denied the request.");
        expect(mismatch(() => parseCallback("https://example.com/callback?state=st", "st")).error).toBe("invalid_request");
    });
});

describe("AppSession", () => {
    test("app(accessToken) sends the bearer to /app/v1 and never the developer key", async() => {
        const fake = fakeFetch(() => ok({ data: { level: 146 } }));
        const krunker = new Krunker({ apiKey: "k", app: credentials, fetch: fake.fetch });
        const me = krunker.app("kat_a");
        expect(me).toBeInstanceOf(AppSession);
        expect(await me.stats.get()).toEqual({ level: 146 } as never);
        await me.stats.ranked(16);
        await me.player.byName("Nul Ping");
        await me.actions.get("act_6Hc2/x");
        await me.dms.messages("21054d5f-757e-4583-a5ef-b60ad7e3899f", { cursor: "179", limit: 50 });
        await me.notifications.list({ unread: true, limit: 10 });
        await me.notifications.list({ unread: false });
        await me.trades.list({ status: "completed", cursor: "YzI" });
        await me.stats.challenges({ type: "weapon", status: "in_progress" });
        expect(fake.calls.map((c) => c.url)).toEqual([
            `${GAPI_URL}/app/v1/stats`,
            `${GAPI_URL}/app/v1/stats/ranked?season=16`,
            `${GAPI_URL}/app/v1/players/by-name/Nul%20Ping`,
            `${GAPI_URL}/app/v1/actions/act_6Hc2%2Fx`,
            `${GAPI_URL}/app/v1/dms/21054d5f-757e-4583-a5ef-b60ad7e3899f?cursor=179&limit=50`,
            `${GAPI_URL}/app/v1/notifications?unread=true&limit=10`,
            `${GAPI_URL}/app/v1/notifications`,
            `${GAPI_URL}/app/v1/trades?status=completed&cursor=YzI`,
            `${GAPI_URL}/app/v1/stats/challenges?type=weapon&status=in_progress`,
        ]);
        for (const call of fake.calls){
            expect(call.headers.Authorization).toBe("Bearer kat_a");
            expect(call.headers["X-Developer-API-Key"]).toBeUndefined();
            expect(call.method).toBeUndefined();
        }
    });

    test("a single object is unwrapped, a list keeps its cursor, me keeps its scopes", async() => {
        const page = { data: [{ skin_index: 113, count: 8, stackable: true, locked: false }], next_cursor: "YzEx" };
        const whoami = { data: { sub: "s", name: "bananas", level: 146, premium: true, verified: false }, scopes: ["profile"] };
        const thread = { peer: { sub: "p", name: "GamerRenamed" }, data: [], next_cursor: "179" };
        const fake = fakeFetch([ok(page), ok(whoami), ok(thread), ok({ data: { clan: null } }), ok({ data: [] })]);
        const me = new KrunkerAppApi({ fetch: fake.fetch }).as("kat_a");
        expect(await me.inventory.items()).toEqual(page);
        expect(await me.player.me()).toEqual(whoami as never);
        expect(await me.dms.messages("p")).toEqual(thread);
        expect(await me.clan.get()).toEqual({ clan: null });
        expect(await me.market.listings()).toEqual([]);
    });

    test("bad arguments and an empty token never cost a request", async() => {
        const fake = fakeFetch([ok({ data: [] })]);
        const app = new KrunkerAppApi({ fetch: fake.fetch });
        expect(() => app.as("")).toThrow(KrunkerTokenError);
        expect(() => new Krunker({ fetch: fake.fetch }).app("  ")).toThrow(KrunkerTokenError);
        const me = app.as("kat_a");
        expect(await caught(() => me.inventory.items({ limit: 101 }))).toBeInstanceOf(KrunkerArgumentError);
        expect(await caught(() => me.inventory.items({ limit: 0 }))).toBeInstanceOf(KrunkerArgumentError);
        expect(await caught(() => me.dms.conversations({ limit: 51 }))).toBeInstanceOf(KrunkerArgumentError);
        expect(await caught(() => me.dms.messages(""))).toBeInstanceOf(KrunkerArgumentError);
        expect(await caught(() => me.stats.ranked(0))).toBeInstanceOf(KrunkerArgumentError);
        expect(await caught(() => me.trades.list({ status: "closed" as never }))).toBeInstanceOf(KrunkerArgumentError);
        expect(await caught(() => me.stats.challenges({ type: "yearly" as never }))).toBeInstanceOf(KrunkerArgumentError);
        expect(await caught(() => me.player.byName(""))).toBeInstanceOf(KrunkerArgumentError);
        expect(fake.calls).toHaveLength(0);
    });

    test("the error code of the app api is on the error", async() => {
        const scope = fakeFetch([{ status: 403, body: { error: { code: "insufficient_scope", message: "missing scope" } } }]);
        const err = await caught(() => new KrunkerAppApi({ fetch: scope.fetch }).as("kat_a").clan.applications()) as KrunkerForbiddenError;
        expect(err).toBeInstanceOf(KrunkerForbiddenError);
        expect(err.code).toBe("insufficient_scope");
        expect(err.message).toContain("missing scope");

        const dead = fakeFetch([{ status: 401, body: { error: { code: "invalid_token", message: "invalid or expired access token" } } }]);
        const gone = await caught(() => new KrunkerAppApi({ fetch: dead.fetch }).as("kat_a").player.me()) as KrunkerUnauthorizedError;
        expect(gone).toBeInstanceOf(KrunkerUnauthorizedError);
        expect(gone.code).toBe("invalid_token");

        const plain = fakeFetch([{ status: 403, body: { error: "Not allowed." } }]);
        const key = await caught(() => new Krunker({ apiKey: "k", fetch: plain.fetch }).player.profile("x")) as KrunkerForbiddenError;
        expect(key.code).toBeNull();
    });

    test("every session has its own rate limit windows", async() => {
        const fake = fakeFetch((call) => (call.headers.Authorization === "Bearer kat_a"
            ? { status: 429, body: { error: { code: "rate_limited", message: "slow down" } }, headers: { "Retry-After": "30" } }
            : ok({ data: { unread: 1 } })));
        const app = new KrunkerAppApi({ fetch: fake.fetch });
        const first = app.as("kat_a");
        const second = app.as("kat_b");
        const limited = await caught(() => first.notifications.count()) as KrunkerRateLimitError;
        expect(limited).toBeInstanceOf(KrunkerRateLimitError);
        expect(limited.retryAfter).toBe(30);
        expect(limited.code).toBe("rate_limited");
        expect(((await caught(() => first.stats.get())) as KrunkerRateLimitError).preemptive).toBe(true);
        expect(await second.notifications.count()).toEqual({ unread: 1 });
        expect(fake.calls).toHaveLength(2);
        expect(first.rateLimit().global?.remaining).toBe(0);
        expect(second.rateLimit().global).toBeNull();
    });
});
