[![License](https://img.shields.io/github/license/NullDev/krapio?label=License&logo=Creative%20Commons)](https://github.com/NullDev/krapio/blob/master/LICENSE) [![pages](https://github.com/NullDev/krapio/actions/workflows/pages.yml/badge.svg)](https://github.com/NullDev/krapio/actions/workflows/pages.yml) [![ci](https://github.com/NullDev/krapio/actions/workflows/ci.yml/badge.svg)](https://github.com/NullDev/krapio/actions/workflows/ci.yml) [![release](https://github.com/NullDev/krapio/actions/workflows/release.yml/badge.svg)](https://github.com/NullDev/krapio/actions/workflows/release.yml) [![NPM Version](https://img.shields.io/npm/v/krapio)](https://www.npmjs.com/package/krapio)


# krapio

<p align="center"><img height="250" width="auto" src="https://raw.githubusercontent.com/NullDev/Kute/refs/heads/master/resources/icon.png" /></p>
<p align="center">Typed client for the READ-ONLY Krunker.io APIs, with Login with Krunker (OAuth 2.0). Zero dependencies, ESM, works on Node 18+ and Bun.<br>Initially made for <a href="https://github.com/NullDev/Kute">Kute Client</a></p>
<hr>

## :sparkles: What is it?

krapio is a typed client for the READ-ONLY Krunker.io APIs. Zero dependencies, ESM, works on Node 18+ and Bun.

It aims for **100%** API coverage.

It covers four things that live behind different doors:

| tier | what | auth | on the client |
|---|---|---|---|
| developer | the documented developer API (`gapi.svc.krunker.io/api/*`) | `X-Developer-API-Key` | the root: `krunker.player`, `krunker.market`, ... |
| game | what the game itself reads without any auth (market, turf, social, shop, matchmaker, legacy lists) | none | `krunker.game.*` |
| token | what the game reads with the player's own FRVR token (wallet, inventory, trades, ranked profile, ...) | `Authorization: Bearer <jwt>` | `krunker.as(token).*` |
| app | Login with Krunker: the OAuth 2.0 flow and what a player lets an app read (stats, inventory, trades, market, friends, clan, mail, DMs) | `Authorization: Bearer kat_...` from an OAuth sign-in | `krunker.oauth.*`, `krunker.app(accessToken).*` |

> [!WARNING]
> Read only. Every write (buying, listing, trading, posting) is left out on purpose, the documented writes of the app API included. <br>
> Also: `game` and `token` API are unofficial. They can break at _any time_.

This project is not affiliated with Krunker.io or FRVR. 

---

## 🗒️ Documentation

Living Spec: https://nulldev.github.io/krapio/
- Krunker APIs:
  - https://nulldev.github.io/krapio/docs/developer-api/
  - https://nulldev.github.io/krapio/docs/game-api/
  - https://nulldev.github.io/krapio/docs/token-api/
  - https://nulldev.github.io/krapio/docs/app-api/
- krapio library: https://nulldev.github.io/krapio/docs/reference/
- OpenAPI: https://nulldev.github.io/krapio/openapi/ (the document itself: https://nulldev.github.io/krapio/openapi.json)

Or in the Repo:
- [Developer API](docs/developer-api.md)
- [Game API](docs/game-api.md)
- [Token API](docs/token-api.md)
- [App API / Login with Krunker](docs/app-api.md)
- [krapio library](docs/index.md)
- [OpenAPI spec](openapi.json)

---

## :wrench: Install

```sh
bun add krapio
# or
npm install krapio
```

Bun runs the TypeScript source directly (`bun` export condition), Node gets the compiled ESM in `dist/` with declarations.

### :postbox: NPM

[![NPM](https://nodei.co/npm/krapio.svg?downloads=true&downloadRank=true&stars=true)](https://www.npmjs.com/package/krapio)

---

## :star: Usage

```ts
import { Krunker } from "krapio";

const krunker = new Krunker({
    apiKey: process.env.KRUNKER_API_KEY, // developer tier only, optional
    userAgent: "my-bot/1.0 (+https://example.org)",
});

// developer api, needs the key
const profile = await krunker.player.profile("NulPing");
const board = await krunker.leaderboard.ranked(3, { season: 15, page: 1 });
const skin = await krunker.market.skin(1234, { days: 30 });

// game endpoints, no auth
const stats = await krunker.game.market.stats({ sort: "rarity", limit: 50 });
const turf = await krunker.game.turf.status();
const raids = await krunker.game.leaderboards.raidsMonthly(18, "2026-10", "completions");

// a player's own data, with the jwt the game gets from FRVR.auth.getFreshAccessToken()
const me = krunker.as(playerToken);
const wallet = await me.player.wallet();
const ranked = await me.ranked.profile(15, 3);
console.log(me.claims.sub); // the player's frvr id, the one stable key for caching
```

Every tier is also its own class when you only need one: `KrunkerDeveloperApi`, `KrunkerGameApi`, `KrunkerTokenApi`, `KrunkerOAuth`, `KrunkerAppApi`.

### :key: Login with Krunker

OAuth 2.0 with PKCE for an app registered under Developer > Applications. The library builds the consent url, exchanges the code, refreshes and revokes; the verifier, the state and the tokens are yours to store.

```ts
import { Krunker, createPkce, createState, parseCallback } from "krapio";

const krunker = new Krunker({
    app: { clientId: "kapp_...", clientSecret: "kas_...", redirectUri: "https://example.com/callback" }, // no secret for a public client
});

// 1. redirect the player; keep verifier and state in their session
const pkce = await createPkce();
const state = createState();
const consentUrl = krunker.oauth.authorizeUrl({ scope: ["profile", "stats:read", "inventory:read"], state, codeChallenge: pkce.challenge });

// 2. on the redirect uri: the state is checked first, a denial throws KrunkerOAuthError
const callback = parseCallback(request.url, state);
if (callback.kind === "code"){
    const tokens = await krunker.oauth.exchangeCode({ code: callback.code, codeVerifier: pkce.verifier });
    // tokens.sub is the player's id in your app, tokens.scope what they actually granted

    // 3. read what the scopes allow
    const player = krunker.app(tokens.access_token);
    const { data: who, scopes } = await player.player.me();
    const stats = await player.stats.get();
    const items = await player.inventory.items({ limit: 100 }); // { data, next_cursor? }
}

// later: the access token lasts an hour, the refresh token works exactly once
const fresh = await krunker.oauth.refresh(tokens.refresh_token); // store fresh.refresh_token right away
await krunker.oauth.revoke(fresh.refresh_token);                 // logout
```

Never refresh the same player's tokens from two places at once: a refresh token used twice revokes the whole sign-in. For that reason the token calls are sent once and never retried.

### :question: Resources

Developer (root): `player` (profile, inventory, listings, matches, posts), `match`, `clan` (profile, members), `leaderboard` (ranked), `map` (get, featured, leaderboard, leaderboardPlayer), `mods` (list, get), `market` (skin), `skins` (list, get), `kpd` (latestCalls, needs the `kpd` scope), `events` (list, needs an events scope).

Webhooks: `verifyWebhook(rawBody, signatureHeader, secret)` checks a delivery's `Krunker-Signature` (HMAC-SHA256 on WebCrypto, 5 minute tolerance) and `signWebhook` produces one for your own tests. Answer 401 when it returns false, Krunker's signature check sends deliberately bad signatures and expects that.

Game (`krunker.game`): `players`, `clans`, `turf`, `leaderboards`, `game` (maps, mods, titles, creator events, the skin and spin data), `shop`, `market`, `items`, `social`, `matchmaker`, `legacy`.

Token (`krunker.as(token)`): `player`, `market`, `trades`, `shop`, `creator`, `staff` (moderator and KPD roles only), `ranked`.

OAuth (`krunker.oauth`): `discovery`, `authorizeUrl`, `exchangeCode`, `refresh`, `revoke`, plus the helpers `createPkce`, `createState` and `parseCallback`.

App (`krunker.app(accessToken)`): `player` (me, byName), `stats` (get, ranked, challenges), `inventory` (items, currencies), `trades` (list, count), `market` (listings, history), `friends` (following, followers), `maps`, `clan` (get, members, applications), `notifications` (list, count), `dms` (conversations, messages), `actions` (the outcome of a per-action approval). Each needs its scope on the token. Lists come back as `{ data, next_cursor? }`. An app's webhook deliveries are typed as `AppWebhookEvent` and checked with the same `verifyWebhook`.

Response types are exported under the names the API uses (`PlayerProfile`, `MarketStats`, `Wallet`, ...), and every method documents its endpoint in its JSDoc. The APIs themselves are documented in `docs/`: [developer-api.md](docs/developer-api.md) (Krunker's document, corrected), [game-api.md](docs/game-api.md) and [token-api.md](docs/token-api.md) (the undocumented tiers, from the game code and live replies), [app-api.md](docs/app-api.md) (Krunker's Login with Krunker document, writes included).

---

## ⚙️ Options

```ts
new Krunker({
    apiKey?: string;    // developer tier; without it those calls throw KrunkerConfigError before any request
    app?: {             // Login with Krunker; without clientId the oauth calls throw KrunkerConfigError
        clientId: string;
        clientSecret?: string; // confidential clients only
        redirectUri?: string;  // the default of authorizeUrl and exchangeCode
    };
    userAgent?: string; // please set one
    timeoutMs?: number; // 20000 (market/skin alone can take seconds on a cold cache)
    retries?: number;   // 1: extra attempts after a network error or a 5xx, never after a 4xx
    fetch?: FetchLike;  // your own fetch (proxy, mock)
    logger?: {          // nothing is logged without one
        debug?: (message: string) => void; // one line per reply and retry
        warn?: (message: string) => void;  // a rate limit window running low
    };
});
```

---

## ⚠️ Errors

Every failure is a `KrunkerError` subclass, nothing else is thrown:

| error | when |
|---|---|
| `KrunkerArgumentError` | an argument the API would reject (empty name, page 0, a bad month); nothing was sent |
| `KrunkerConfigError` | a developer call without an api key; nothing was sent |
| `KrunkerTokenError` | `as(token)` with something that is not a live jwt (malformed, expired within 30 s), `app(accessToken)` with an empty one; nothing was sent |
| `KrunkerOAuthError` | `parseCallback` on a redirect whose state is not yours (`state_mismatch`) or that carries an `error` (`access_denied`, ...) |
| `KrunkerNetworkError` | no http reply, `timeout` says whether it was the timeout |
| `KrunkerHttpError` | any other status, with `status`, `url`, the parsed `body` and its `code` (`insufficient_scope`, `invalid_grant`, ...) when it has one |
| `KrunkerBadRequestError` | 400 |
| `KrunkerUnauthorizedError` | 401, a token or app endpoint without a valid token, an oauth call with bad client credentials |
| `KrunkerForbiddenError` | 403, a bad key, a role the player lacks or a scope the app token lacks |
| `KrunkerNotFoundError` | 404 |
| `KrunkerRateLimitError` | 429, with `retryAfter` seconds; `preemptive` is true when the client refused to send because it knew the window was empty |
| `KrunkerServerError` | 5xx |

`isNotFound`, `isRateLimited` and `isTransient` are small guards for the common branches.

---

## 🌐 Rate limits

The developer key has 240 requests a minute. `gapi` also sends per route windows of 5 requests a second. The client mirrors the `X-RateLimit-*` headers of every reply:

- a window under 2 s is waited out instead of refused (gapi's per second windows are over before you could react),
- a longer empty window throws `KrunkerRateLimitError` with `preemptive: true` before a request goes out,
- `krunker.rateLimit()` returns what the last replies said about the key's window.

One `Krunker` instance per key: the tracker lives on the instance, two instances cannot see each other's window.

The app API counts per app and player (120 reads a minute), so every `krunker.app(accessToken)` session has a tracker of its own: one player running into a limit does not hold back the others. `session.rateLimit()` shows it.

---

## 🔒 Tokens

A player token is sent as a bearer header and nothing else: never stored, never logged, never used for a write. The claims are decoded without verifying the signature (Krunker verifies it), only to refuse an expired token locally and to give you `sub`.

The same holds for the tokens of Login with Krunker: the access token is a bearer header, the client secret a basic auth header, the refresh token a form field of the one request that spends it. They are opaque, so nothing is decoded, and nothing is kept between calls.

---

## :octocat: Development

```sh
bun install
bun run typecheck
bun run lint
bun test      # unit tests against a fake fetch, no network
bun run build # dist/
KRUNKER_API_KEY=... bun run live # a dozen reads against the real api, KRUNKER_TOKEN and KRUNKER_APP_TOKEN optional
bun run openapi # regenerates openapi.json, every endpoint of the four tiers as an OpenAPI 3.1 document
```

The OpenAPI document is generated from the resource classes (paths, parameters, response types) and the exported types, with field descriptions filled in from `docs/`. It is never edited by hand: run `bun run openapi` after changing a resource, the test suite fails when the checked in file is stale, and the `pages` workflow publishes it with the site.

The documentation site (`site/`, Fumadocs on Next.js, exported statically to GitHub Pages by the `pages` workflow) renders `docs/` plus a library reference TypeDoc generates from `src/`:

```sh
cd site && bun install
bun run dev   # syncs docs/ and the reference into content/, then next dev
bun run build # the static export in site/out, served under /krapio (BASE_PATH="" for a domain of its own)
```

**Releasing.** Bump `version` in `package.json`, commit, tag it `v<version>` and push the tag. The `release` workflow checks that the tag matches the version, runs the pre-publish gate (lint, typecheck, tests, build) and publishes to npm through trusted publishing with provenance, so no npm token lives in the repository or its secrets.

The site serves the OpenAPI document at `/openapi.json` and offers it for download at `/openapi/`. Under every endpoint of the four API pages it embeds Scalar's rendering of that operation (parameters, responses, request samples, response example) from a slice of the document.

---
