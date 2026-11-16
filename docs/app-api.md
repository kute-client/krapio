---
title: App API
description: Login with Krunker, OAuth 2.0 and the API a player lets an app use
---

Base URL: https://gapi.svc.krunker.io/app/v1

This is the Login with Krunker documentation as provided by Krunker (FRVR) in November 2026, rearranged to the layout of the other pages. Notes marked *observed* were found by calling the service without credentials in November 2026: the discovery document, the refusal of the token endpoint and the refusal of the app API. Everything else is reproduced as documented and not verified, no app was registered to check it with.

Login with Krunker lets players sign in to a website, bot or tool with their Krunker account. With their consent, an app can also read their game data (stats, inventory, trades, friends, ...) and act for them (list on the market, trade, send KR, follow players, send DMs).

It is standard **OAuth 2.0**: the authorization code flow with **PKCE (S256)**, refresh tokens with rotation, token revocation (RFC 7009), a discovery document (RFC 8414) and a small userinfo endpoint. Implicit flow, password grant and client credentials are not offered.

| | URL |
| --- | --- |
| API base | `https://gapi.svc.krunker.io` |
| App API | `https://gapi.svc.krunker.io/app/v1` |
| Discovery | `https://gapi.svc.krunker.io/.well-known/oauth-authorization-server` |
| Consent page | `https://krunker.io/oauth/authorize` |

In krapio the flow lives on `krunker.oauth` and the reads on `krunker.app(accessToken).*`. Every write of the app API (market, trades, items, KR, follows, DMs) is documented [below](#acting-for-the-player) and left out of the library on purpose, like the writes of the other tiers; their body and reply types are exported anyway.

```ts
import { Krunker, createPkce, createState, parseCallback } from "krapio";

const krunker = new Krunker({ app: { clientId: "kapp_...", clientSecret: "kas_...", redirectUri: "https://example.com/callback" } });

// 1. send the player to the consent page; keep verifier and state in their session
const pkce = await createPkce();
const state = createState();
const url = krunker.oauth.authorizeUrl({ scope: ["profile", "stats:read"], state, codeChallenge: pkce.challenge });

// 2. back on the redirect uri: check the state, exchange the code
const callback = parseCallback(request.url, state);
if (callback.kind === "code"){
    const tokens = await krunker.oauth.exchangeCode({ code: callback.code, codeVerifier: pkce.verifier });

    // 3. read with the access token
    const me = krunker.app(tokens.access_token);
    const { data: player, scopes } = await me.player.me();
    const stats = await me.stats.get();
}
```

## What players see

- They sign in on krunker.io (the page reuses their game session) and see your app's name, icon, developer and links, and the list of scopes you asked for.
- Their account must have **2FA enabled** to connect any app. Banned accounts can't connect apps.
- They can untick optional scopes, so your app may get fewer scopes than it asked for.
- Write scopes are shown in a warning block with a disclaimer they must tick, and granting one asks for a **fresh 2FA code**.
- Everything your app does on their account counts as their own action and is listed in their app activity. Krunker support can't recover items, KR or currency lost through a third-party app.
- They can disconnect your app at any time in Krunker (Account > Connections > Connected apps). Its tokens stop working immediately.

Things an app can never do: spend real money or KR in the shop, spins or premium; touch account security (name, email, password, 2FA, deletion, linked accounts); report players or use moderation tools; or use items the player has **locked** in game.

---

## Registering an app

Apps are managed in the partner portal under **Developer > Applications**. The section appears once the Krunker team has given your developer key an app quota. Creating an app requires accepting the Krunker API & App Terms.

### App settings

| Setting | Rules |
| --- | --- |
| Name | 2 to 40 characters, shown on the consent page |
| Description | Up to 300 characters |
| Homepage, privacy policy, terms of service | Optional `https://` URLs. A privacy policy is required before you can request a write scope |
| Redirect URIs | 1 to 10, one per line, matched **exactly** (no wildcards, no fragments, no credentials). `https://` only, except `http://localhost` and `http://127.0.0.1` (any port), which work only while the app is in dev mode |
| Client type | **Confidential** (a server that keeps a client secret) or **public** (a browser or native app with no secret, PKCE only). Public clients get read scopes only |
| Icon | Square PNG, JPEG or WebP, 64 to 1024 px, up to 256 KB |

When the terms change, you accept the new version before your next settings change. Existing tokens keep working.

### Credentials

- **Client id** `kapp_...`: public, sent in authorize and token requests.
- **Client secret** `kas_...` (confidential apps only): shown **once** when you create the app or rotate it. Keep it on your server. After a rotation the previous secret keeps working for 24 hours, so you can deploy the new one.

In krapio both go into `new Krunker({ app: { clientId, clientSecret, redirectUri } })`, or into `new KrunkerOAuth({ ... })` when the flow is all you need. Leave `clientSecret` out for a public client.

### Scopes for your app

A new app can only use `profile`. Request every other scope on the app page with a short reason; the Krunker team reviews each request. Only approved scopes (plus `profile`) may appear in an authorize request; anything else is refused with `invalid_scope`.

### Dev mode, testers and going live

| Status | Who can authorise | Notes |
| --- | --- | --- |
| Dev mode | You and up to 25 testers | Every new app starts here. Add testers by player name on the app page. Loopback redirect URIs work |
| Live | Every player | Ask the Krunker team to make the app live once it is ready. Loopback redirect URIs stop working |
| Suspended | Nobody | Set by the Krunker team. Tokens are rejected and the consent page shows the app as unavailable. You can only delete it |

Apps also stop working while your developer key is disabled.

---

## Discovery

Standard OAuth client libraries can configure themselves from the discovery document:

```text
GET https://gapi.svc.krunker.io/.well-known/oauth-authorization-server
```

`krunker.oauth.discovery()`

```json
{
  "issuer": "https://gapi.svc.krunker.io",
  "authorization_endpoint": "https://krunker.io/oauth/authorize",
  "token_endpoint": "https://gapi.svc.krunker.io/oauth/token",
  "revocation_endpoint": "https://gapi.svc.krunker.io/oauth/revoke",
  "userinfo_endpoint": "https://gapi.svc.krunker.io/app/v1/me",
  "scopes_supported": ["profile", "stats:read", "notifications:read", "inventory:read", "inventory:write:skins", "inventory:write:currency", "inventory:write", "trades:read", "trades:write", "market:read", "market:write", "friends:read", "friends:write", "dms:read", "dms:write", "clan:read", "maps:read", "events:subscribe"],
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "code_challenge_methods_supported": ["S256"],
  "token_endpoint_auth_methods_supported": ["client_secret_basic", "client_secret_post", "none"]
}
```

*observed*: the live document is exactly this, needs no auth and lists the same 18 scopes.

Tokens are opaque strings, not JWTs, so there is no JWKS or ID token. Use `GET /app/v1/me` to get the player.

---

## Signing a player in

### 1. Create a PKCE verifier and a state

For every sign-in attempt, generate:

- a **code verifier**: 43 to 128 characters from `A-Z a-z 0-9 - . _ ~` (32 random bytes, base64url-encoded, gives 43);
- its **code challenge**: `base64url(sha256(verifier))` without padding (43 characters);
- a random **state** (required, up to 500 characters), tied to the visitor's session so you can check it on the way back.

Keep the verifier and state on your side; only the challenge and state go in the URL.

```ts
import { createPkce, createState } from "krapio";

const { verifier, challenge } = await createPkce(); // WebCrypto, so it runs in node, bun and a browser
const state = createState();
```

### 2. Send the player to the consent page

Redirect the browser to the authorization endpoint:

```text
https://krunker.io/oauth/authorize
  ?response_type=code
  &client_id=kapp_3f9c0a1b2c3d4e5f60718293
  &redirect_uri=https%3A%2F%2Fexample.com%2Fcallback
  &scope=profile%20stats%3Aread%20inventory%3Aread
  &state=Zt3nq0H1oV8yXw2cJ5bL4g
  &code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
  &code_challenge_method=S256
```

`krunker.oauth.authorizeUrl({ scope, state, codeChallenge, redirectUri })` builds it. Nothing is sent.

| Parameter | Required | Description |
| --- | --- | --- |
| `response_type` | yes | Always `code` |
| `client_id` | yes | Your `kapp_...` id |
| `redirect_uri` | yes | One of your registered redirect URIs, character for character |
| `scope` | yes | Space-separated scopes. `profile` is always added |
| `state` | yes | Your random value, returned unchanged |
| `code_challenge` | yes | The S256 challenge from step 1 |
| `code_challenge_method` | yes | Always `S256`; `plain` is not supported |

If the player already granted every scope you ask for, the page shows a one-click "Continue as ..." instead of the full consent screen. A new write scope always shows the full screen.

### 3. Handle the redirect back

When the player approves, the browser comes back to your redirect URI:

```text
https://example.com/callback?code=x5bH1v...&state=Zt3nq0H1oV8yXw2cJ5bL4g
```

Check that `state` matches the one you stored for this visitor before doing anything else. The code is valid for **60 seconds** and can be used **once** (a failed exchange also uses it up). It only works with your client id and the same redirect URI.

If the player declines, or the request was invalid, you get an error instead:

```text
https://example.com/callback?error=access_denied&error_description=The+player+denied+the+request.&state=Zt3nq0H1oV8yXw2cJ5bL4g
```

| `error` | Meaning |
| --- | --- |
| `access_denied` | The player declined |
| `invalid_request` | `state` is missing or too long, or PKCE is missing or not S256 |
| `invalid_scope` | An unknown scope, or one that isn't approved for your app (or is a write scope on a public client) |
| `unsupported_response_type` | `response_type` isn't `code` |

Some problems are shown to the player on the Krunker page and **never** sent back to your app, because the redirect can't be trusted or the player has to fix something first: unknown client id, a redirect URI that isn't registered (or a loopback URI on a live app), an unavailable app, an app in dev mode that the player isn't a tester of, a banned account, an account without 2FA, a level too low for a scope, or a wrong 2FA code.

In krapio `parseCallback(url, expectedState)` does the state check first and then returns `{ kind: "code", code }`. It throws `KrunkerOAuthError` when the state is not yours (`error` is `state_mismatch`) or the redirect carries an `error` (`access_denied`, ...). The same function reads the redirect of a [per-action approval](#per-action-approval), as `{ kind: "action", actionId, status }`.

### 4. Exchange the code for tokens

```text
POST https://gapi.svc.krunker.io/oauth/token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic base64(urlencode(client_id) + ":" + urlencode(client_secret))

grant_type=authorization_code&code=x5bH1v...&redirect_uri=https%3A%2F%2Fexample.com%2Fcallback&code_verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
```

`krunker.oauth.exchangeCode({ code, codeVerifier, redirectUri })`

How your app authenticates depends on its client type:

| Client type | How to send credentials |
| --- | --- |
| Confidential | HTTP Basic with `client_id:client_secret` (recommended), or `client_id` and `client_secret` in the body |
| Public | `client_id` in the body and no secret. Sending a secret fails with `invalid_client` |

The body can also be JSON (`Content-Type: application/json`) with the same field names. krapio sends a form body, with HTTP Basic when it has a secret and `client_id` in the body when it has none.

**Response (200):**

```json
{
  "access_token": "kat_Q2xh...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "krt_9mWv...",
  "scope": "profile stats:read",
  "sub": "0f29b001-eb77-4d21-885f-c121a6511df4"
}
```

- `scope` is what the player actually granted this time. It can be a subset of what you asked for; check it rather than assuming.
- `sub` is the player's [subject id](#subjects) in your app. Use it as your user key.
- Responses carry `Cache-Control: no-store`. Store tokens server-side, never in URLs or logs.

krapio returns this body as it is (`OAuthTokens`) and keeps none of it. It sends a token request once and never retries it, not even after a network error or a 5xx: the first attempt may have spent the code or the refresh token.

---

## Tokens

### Lifetimes

| What | Lifetime |
| --- | --- |
| Authorization code | 60 seconds, single use |
| Access token `kat_...` | 1 hour (`expires_in: 3600`) |
| Refresh token `krt_...` | 60 days from when it was issued. Each refresh gives a new one with a fresh 60 days |
| Per-action approval | 10 minutes to approve; the result is kept 24 hours |

An access token also stops working before it expires when the player disconnects your app, the player is banned, your app is suspended or your developer key is disabled. Changes made by Krunker take effect within about 15 seconds.

### Refreshing

```text
POST https://gapi.svc.krunker.io/oauth/token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic ...

grant_type=refresh_token&refresh_token=krt_9mWv...
```

`krunker.oauth.refresh(refreshToken)`

The response has the same shape as the code exchange, with a **new** access token and a **new** refresh token. Refresh tokens rotate:

- Each refresh token works **once**. Store the new one right away.
- If a refresh token is used a second time, Krunker treats it as stolen: the whole chain of refresh tokens from that sign-in is revoked, as are all of the player's access tokens for your app. The player has to sign in again.
- So never refresh the same player's tokens concurrently. Refresh in one place, for example a minute before `expires_in` runs out.
- The refreshed token keeps the scopes of the old one that the player still grants.
- Refreshing fails with `invalid_grant` once the player has disconnected your app or is banned.

A session of krapio is bound to one access token and does not refresh by itself: refresh where you store the tokens, then make a new `krunker.app(tokens.access_token)`.

### Revoking

```text
POST https://gapi.svc.krunker.io/oauth/revoke
Content-Type: application/x-www-form-urlencoded
Authorization: Basic ...

token=krt_9mWv...
```

`krunker.oauth.revoke(token)`

- Answers `200` with an empty body for any token, valid or not, as long as your client authentication is right (RFC 7009).
- Revoking a **refresh** token revokes its whole chain. Access tokens already issued keep working until they expire, so revoke the current access token too when a user logs out of your app.
- Revoking an **access** token ends only that token.
- Revoking doesn't disconnect your app for the player; only the player can do that, in Krunker. A later sign-in with the same scopes is one click for them.

### Token endpoint errors

The token and revoke endpoints use the standard OAuth error format: `{"error": "...", "error_description": "..."}`.

| Status | `error` | When |
| --- | --- | --- |
| 400 | `invalid_grant` | The code is unknown, expired, already used, from another client or redirect URI, or the `code_verifier` doesn't match. A refresh token that is unknown, expired, revoked or reused. The player disconnected the app or is banned |
| 400 | `unsupported_grant_type` | `grant_type` isn't `authorization_code` or `refresh_token` |
| 401 | `invalid_client` | Unknown client id, wrong secret, a secret sent by a public client, or a suspended app |
| 429 | | More than 600 requests per minute for your client id |
| 500 | `server_error` | Our side failed; try again |
| 503 | `temporarily_unavailable` | Revoke only; try again |

*observed*: a request without client authentication is checked for that first, whatever the grant type: `401 {"error": "invalid_client", "error_description": "client authentication failed"}` with `WWW-Authenticate: Basic realm="krunker"` and `Cache-Control: no-store`. The reply carries `X-RateLimit-Limit: 600`, `X-RateLimit-Remaining` and `X-RateLimit-Reset` (seconds until the window ends).

In krapio these are the usual errors (`KrunkerBadRequestError`, `KrunkerUnauthorizedError`, `KrunkerRateLimitError`, ...), and `err.code` is the `error` of the body, e.g. `invalid_grant`.

---

## Scopes

Scopes are space-separated in the authorize request. `profile` is always included. A write scope includes its read scope: a token with `trades:write` can call the `trades:read` endpoints, and so on.

| Scope | Allows | Write |
| --- | --- | --- |
| `profile` | The player's subject id, name, level, clan tag and premium/verified flags (`/me`). Always granted | |
| `stats:read` | Lifetime stats, ranked profile per region and season, challenge progress | |
| `notifications:read` | Krunker Mail and system notices | |
| `inventory:read` | Items (instances, stacks, wear, paint, locks) and currency balances | |
| `inventory:write:skins` | Quick-sell, paint, style and lock items (apps can never unlock) | yes |
| `inventory:write:currency` | Send KR to another player | yes |
| `inventory:write` | Both inventory write scopes | yes |
| `trades:read` | Open and completed trades, trade count | |
| `trades:write` | Create, accept, cancel and decline trades | yes, level 10 |
| `market:read` | The player's own listings and market history | |
| `market:write` | List, unlist and buy on the market | yes, level 10 |
| `friends:read` | Following and followers, with online status | |
| `friends:write` | Follow and unfollow players | yes |
| `dms:read` | Direct message conversations and messages | |
| `dms:write` | Send DMs to the player's friends, shown as "via" your app | yes |
| `clan:read` | The player's clan, its members and (for officers) join applications | |
| `maps:read` | The player's published maps and their stats | |
| `events:subscribe` | Receive [webhooks](#webhooks) about the player | server only |

- **Every scope except `profile` needs approval** from the Krunker team for your app.
- **Write scopes** are for confidential clients only, need a privacy policy URL on the app, are shown to the player with a warning, and need a fresh 2FA code at consent. `trades:write` and `market:write` also need the player to be level 10, the same as in game.
- **`events:subscribe`** is for confidential clients only, but it isn't a write scope: no warning and no 2FA code.
- A public client that needs to act can use [per-action approval](#per-action-approval) instead of a write scope.

krapio exports the list as `APP_SCOPES` and the type `AppScope`.

---

## Subjects

Players are never identified by their Krunker player id. Your app sees every player (the signed-in one and anyone else) as a **subject id**:

```text
0f29b001-eb77-4d21-885f-c121a6511df4
```

- It looks like a UUID, but treat it as an opaque string.
- It is **per app**: the same player has a different subject in every app, so apps can't join their data on it.
- It is **stable**: it stays the same when the player renames, disconnects or reconnects. Use it as the key for your users, not the name.
- Endpoints that take a player (`to`, `:sub`) take a subject id. A subject from another app, or a made-up one, is `404 not_found`.
- To find a player by name, use [`GET /app/v1/players/by-name/:name`](#look-up-a-player-by-name).
- Other players appear as `{ "sub": "...", "name": "..." }`. Names are public and can change.

Item instance ids, trade ids and listing ids are global ids, the same everywhere in Krunker.

---

## Conventions

- **Base URL:** `https://gapi.svc.krunker.io/app/v1`. Every request sends `Authorization: Bearer kat_...`. Write requests send JSON bodies with `Content-Type: application/json`.
- **Success:** `{ "data": ... }`. Lists also carry `"next_cursor"` when there is another page.
- **Paging:** pass `next_cursor` back as `?cursor=` to get the next page. Cursors are opaque; don't build or parse them. `?limit=` defaults to 50 and is capped at 100 (DMs: default 20, cap 50); 0 or a negative value is `400`. A page can hold fewer items than the limit, so keep going while `next_cursor` is present.
- **Errors:** `{ "error": { "code": "...", "message": "..." } }`. Branch on `code`; `message` is human-readable and can change. See [Errors](#errors).
- **Players** appear as `{ "sub": "...", "name": "..." }`. See [Subjects](#subjects).
- **Times** are RFC 3339 UTC strings; durations are milliseconds (`*_ms`).
- **Ids** are named after what they identify and are the same in reads, writes and webhooks: `skin_index` (catalog item), `instance_id` (one owned copy), `listing_id`, `trade_id`, `notification_id`, `map_id`, `clan_id`, `currency_id`, `message_id`.
- **Item names, images and rarities** aren't in app responses. Look them up by `skin_index` in the public catalog, `GET https://gapi.svc.krunker.io/data/skins` ([Skins](game-api.md#skins) of the game API, `krunker.game.game.skins()`).
- **Scopes:** each request runs with the token's scopes that the player still grants. A missing scope is `403 insufficient_scope`, with `WWW-Authenticate: Bearer error="insufficient_scope", scope="..."`.

In krapio a single object comes back unwrapped (`await me.stats.get()` is the `data`), a list comes back as the page it is, `{ data, next_cursor? }`, so the cursor is not lost:

```ts
const me = krunker.app(accessToken);
let cursor: string | undefined;
do {
    const page = await me.inventory.items({ cursor, limit: 100 });
    for (const item of page.data) console.log(item.skin_index, item.count);
    cursor = page.next_cursor;
} while (cursor);
```

`limit` is checked before the request (1 to 100, 1 to 50 for DMs). An error is the usual `KrunkerHttpError` subclass, with the body's code as `err.code`.

### Rate limits

| Limit | Value |
| --- | --- |
| Per app | 600 requests per minute |
| Per app and player, reads | 120 requests per minute |
| Per app and player, writes | 20 requests per minute |
| Send KR | Also 5 per minute per app and player |
| DMs | Also 10 per minute and 200 per day per app and player |
| Approval requests | 20 per 10 minutes per app and player |

Over a limit you get `429 rate_limited` with `Retry-After` (seconds). The game's own limits and cooldowns apply on top: for example, the market allows one action at a time per player, and a trade can only be accepted a few seconds after it was created.

In krapio every `krunker.app(accessToken)` session tracks its own windows, since most of these are counted per player: a 429 for one player throws `KrunkerRateLimitError` and refuses that session's next calls locally until `Retry-After` has passed, without holding back the sessions of other players.

---

## The Player

Scope `profile`, which every token has.

### Me

```http
GET /app/v1/me
```

`krunker.app(accessToken).player.me()`

The signed-in player. This is also the discovery document's `userinfo_endpoint`.

**Response:**

```json
{
  "data": {
    "sub": "0f29b001-eb77-4d21-885f-c121a6511df4",
    "name": "bananas",
    "level": 146,
    "clan": "ALPHA",
    "premium": true,
    "verified": false
  },
  "scopes": ["profile", "stats:read", "inventory:read"]
}
```

`clan` is omitted when the player has no clan. `scopes` lists the scopes this token can use right now. It sits next to `data`, so krapio returns the whole body here: `const { data: player, scopes } = await me.player.me()`.

*observed*: without a token the reply is `401 {"error": {"code": "invalid_token", "message": "missing or malformed access token"}}`, with a made-up one the message is `invalid or expired access token`. Both carry `WWW-Authenticate: Bearer error="invalid_token"` and no rate limit headers.

### Look up a player by name

```http
GET /app/v1/players/by-name/:name
```

`krunker.app(accessToken).player.byName(name)`

Returns the same fields as `/me` (without `scopes`) for any player, so you can get their subject id. Banned and hidden accounts are `404 not_found`.

**Response:**

```json
{ "data": { "sub": "21054d5f-757e-4583-a5ef-b60ad7e3899f", "name": "GamerRenamed", "level": 52, "premium": false, "verified": false } }
```

---

## The item object

Used by the inventory, trades and market listings (`AppItem` in krapio).

```json
{
  "instance_id": 200107647,
  "skin_index": 7584,
  "count": 1,
  "stackable": false,
  "locked": true,
  "wear": 0.62,
  "wear_tier": "Wrecked",
  "serial": 42,
  "paint": "#dc3c3c",
  "style": 3,
  "nametag": "my AWP",
  "pattern_seed": 693909,
  "kounter": { "kills": 1285 }
}
```

- `instance_id` is the copy's global id. Stackable items have no `instance_id`; they are counted with `count` and addressed by `skin_index`.
- `locked` (inventory only): the player locked this copy or stack in game. Apps can't use locked items.
- The other fields appear only when the copy has them: `wear` (0 is best), `wear_tier` (`Flawless`, `Tested`, `Trashed` or `Wrecked`), `serial` (mint number), `paint` (hex colour) or `paint_shader` (paint shader id), `style`, `nametag`, `pattern_seed` (0 to 999999) and `kounter` (kill-counter values by stat: `kills`, `hskills`, `aikills`, `headshots`, `hits`, `shots`, `jumps`).

---

## Stats

Scope `stats:read`.

### Lifetime Stats

```http
GET /app/v1/stats
```

`krunker.app(accessToken).stats.get()`

Lifetime stats. KR and other currency fields aren't included.

**Response:**

```json
{
  "data": {
    "level": 146, "score": 23872353, "kills": 4308, "deaths": 68, "kdr": 63.35,
    "wins": 48, "losses": 2682, "games": 2730, "time_played_ms": 139613906, "accuracy": 26.39,
    "combat": {
      "assists": 0, "headshots": 393, "legshots": 0, "wallbangs": 0, "melee_kills": 4,
      "fist_kills": 0, "thrown_kills": 0, "shots": 2994, "hits": 790, "nukes": 0,
      "airdrops": 0, "airdrops_stolen": 0, "slimers": 0, "juggernauts": 0,
      "juggernauts_killed": 0, "war_machines": 0, "crouches": 4215, "sprays": 4
    },
    "classes": [ { "class_id": 0, "name": "Triggerman", "score": 124218, "level": 11 } ],
    "raids": [ { "map_id": 47, "completions": 2, "attempts": 5, "best_time_ms": 512000, "ai_kills": 340, "boss_kills": 2, "deaths": 9 } ]
  }
}
```

`accuracy` is a percentage (hits / shots). `classes` lists every class in game order.

### Ranked Stats

```http
GET /app/v1/stats/ranked?season=
```

`krunker.app(accessToken).stats.ranked(season)`

Ranked profile per region. `season` defaults to the current season and must be between 1 and `current_season`.

**Response:**

```json
{
  "data": {
    "season": 16, "current_season": 16, "season_ends_at": "2026-12-01T00:00:00Z",
    "regions": [
      {
        "region": 3, "region_name": "Europe", "rank": "Diamond", "mmr": 3207, "peak_mmr": 3250,
        "placement_matches_remaining": 0, "matches": 40, "wins": 40, "losses": 0,
        "kills": 21, "deaths": 16, "assists": 10, "score": 3435, "damage_done": 2064,
        "time_played_ms": 404984, "best_kills_in_match": 21, "best_damage_in_match": 2064
      }
    ]
  }
}
```

- During placement (the first 6 matches) `rank` is `"Unranked"`, `mmr` is `null` and `placement_matches_remaining` counts down.
- `peak_mmr` is present once the season tracks it. `regions` is empty when the player hasn't played that season.

### Challenges

```http
GET /app/v1/stats/challenges?type=&status=&cursor=&limit=
```

`krunker.app(accessToken).stats.challenges({ type, status, cursor, limit })`

Active challenges with the player's progress. Paged.

| Query | Description |
| --- | --- |
| `type` | `map`, `weapon`, `nightmare`, `ranked`, `daily`, `weekly` or `event` |
| `status` | `all` (default), `completed` or `in_progress` |
| `cursor`, `limit` | Paging |

**Response:**

```json
{
  "data": [
    {
      "challenge_id": 908, "name": "Get a 10 killstreak", "type": "weapon", "icon": 4,
      "requirement": { "ky": "kstk", "wep": 1, "val": 10 },
      "target": 10, "progress": 14, "completed": true,
      "rewards": { "kr": 10, "jnk": 0.05 },
      "ends_at": "2026-11-09T00:00:00Z"
    }
  ],
  "next_cursor": "YzI"
}
```

`requirement` and `rewards` are the game's own challenge definition, passed through as they are. `ends_at` is absent for challenges without an end date.

---

## Inventory

Scope `inventory:read`.

### Items

```http
GET /app/v1/inventory/items?cursor=&limit=
```

`krunker.app(accessToken).inventory.items({ cursor, limit })`

The player's items, the same set the in-game inventory shows (paged). Copies listed on the market are left out, and stack counts exclude listed units.

**Response:**

```json
{
  "data": [
    { "skin_index": 113, "count": 8, "stackable": true, "locked": false },
    { "instance_id": 200107647, "skin_index": 7584, "count": 1, "stackable": false, "locked": true, "wear": 0.62, "wear_tier": "Wrecked", "serial": 42, "pattern_seed": 693909 }
  ],
  "next_cursor": "YzExODc4NDAzOA"
}
```

### Currencies

```http
GET /app/v1/inventory/currencies
```

`krunker.app(accessToken).inventory.currencies()`

Balances. KR and Junk are always present; other currencies only when the player holds some.

**Response:**

```json
{
  "data": [
    { "currency_id": 1, "name": "Krunkies", "symbol": "KR", "amount": 525369 },
    { "currency_id": 2, "name": "Junk", "symbol": "JNK", "amount": 1189.94 },
    { "currency_id": 3, "name": "Ranked Points", "symbol": "RP", "amount": 20802 }
  ]
}
```

---

## Trades

Scope `trades:read`. Creating, accepting and cancelling are [writes](#trades-tradeswrite) and are not in krapio.

### List Trades

```http
GET /app/v1/trades?status=&cursor=&limit=
```

`krunker.app(accessToken).trades.list({ status, cursor, limit })`

`status` is `open` (default) or `completed`. Open trades include both directions; completed trades are newest first.

**Response:**

```json
{
  "data": [
    {
      "trade_id": 8880923, "status": "completed", "role": "sender",
      "partner": { "sub": "0f29b001-eb77-4d21-885f-c121a6511df4", "name": "bananas" },
      "offered": {
        "items": [ { "instance_id": 200000099, "skin_index": 7582, "count": 1, "stackable": false, "serial": 3 } ],
        "currencies": []
      },
      "requested": { "items": [], "currencies": [ { "currency_id": 1, "amount": 50 } ] },
      "message": "t2",
      "created_at": "2026-11-03T17:38:48Z",
      "completed_at": "2026-11-03T17:39:41Z"
    }
  ],
  "next_cursor": "YzI"
}
```

- `role` is `sender` when the player created the trade and `recipient` when it was sent to them.
- `offered` is what the sender gives; `requested` is what the sender asks for.
- `partner` is `null` if that account no longer exists.

### Trade Count

```http
GET /app/v1/trades/count
```

`krunker.app(accessToken).trades.count()`

**Response:**

```json
{ "data": { "open": 2, "completed": 51 } }
```

---

## Market

Scope `market:read`. Only the player's own market data. Public market data (listings, prices) is on the public market endpoints of the [game API](game-api.md#market) and needs no scope.

### Listings

```http
GET /app/v1/market/listings
```

`krunker.app(accessToken).market.listings()`

All of the player's active listings. Not paged: the game caps active listings.

**Response:**

```json
{
  "data": [
    { "listing_id": 24971166, "price": 700, "item": { "skin_index": 172, "count": 1, "stackable": true }, "listed_at": "2026-01-11T01:43:41Z" }
  ]
}
```

### History

```http
GET /app/v1/market/history?cursor=&limit=
```

`krunker.app(accessToken).market.history({ cursor, limit })`

Completed sales and purchases plus cancelled listings, newest first (paged). Quick-sells aren't included.

**Response:**

```json
{
  "data": [
    { "listing_id": 24971183, "side": "bought", "status": "completed", "skin_index": 2583, "price": 200,
      "counterparty": { "sub": "21054d5f-757e-4583-a5ef-b60ad7e3899f", "name": "GamerRenamed" },
      "at": "2026-11-06T22:38:03Z" }
  ],
  "next_cursor": "YzI0OTcxNzgw"
}
```

`side` is `sold` or `bought`; `status` is `completed` or `cancelled`. A cancelled listing has no `counterparty`.

---

## Friends

Scope `friends:read`.

### Following and Followers

```http
GET /app/v1/friends/following?cursor=&limit=
GET /app/v1/friends/followers?cursor=&limit=
```

`krunker.app(accessToken).friends.following({ cursor, limit })`, `.friends.followers({ cursor, limit })`

Newest first (paged). Banned and hidden accounts are left out.

**Response:**

```json
{
  "data": [
    { "sub": "21054d5f-757e-4583-a5ef-b60ad7e3899f", "name": "GamerRenamed", "since": "2026-07-02T13:44:21Z", "online": true }
  ]
}
```

`online` is omitted when presence is temporarily unavailable; treat a missing value as unknown, not offline.

---

## Maps

Scope `maps:read`.

### Published Maps

```http
GET /app/v1/maps?cursor=&limit=
```

`krunker.app(accessToken).maps.list({ cursor, limit })`

The player's published maps, newest first (paged). Map KR balances aren't included.

**Response:**

```json
{
  "data": [
    { "map_id": 157692, "name": "Frostfang", "description": "Snowy arena", "votes": 0, "plays": 31, "playtime_ms": 1615251,
      "featured": false, "verified": false, "restricted": false, "category": 0, "updates": 28,
      "created_at": "2026-11-04T14:54:47Z", "updated_at": "2026-11-05T18:08:22Z" }
  ],
  "next_cursor": "YzE1NzY5Mg"
}
```

`description` is omitted when empty. `playtime_ms` is the total time players have spent in the map.

---

## Clan

Scope `clan:read`.

### Get Clan

```http
GET /app/v1/clan
```

`krunker.app(accessToken).clan.get()`

**Response:**

```json
{
  "data": {
    "clan": { "clan_id": 445646, "name": "ALPHA", "score": 3201, "rank": 0, "logo": 1769084608, "banner_color": "#1a1a1a", "member_count": 8 },
    "role": "captain",
    "is_officer": true
  }
}
```

- When the player has no clan: `{ "data": { "clan": null } }`.
- `role` is `owner`, `commander`, `captain`, `soldier` or `recruit`.
- `is_officer` means the player can see join applications (the owner or a captain, as in game). The clan's KR bank isn't included.

### Clan Members

```http
GET /app/v1/clan/members?cursor=&limit=
```

`krunker.app(accessToken).clan.members({ cursor, limit })`

Paged. `404 not_found` when the player has no clan.

**Response:**

```json
{
  "data": [ { "sub": "21054d5f-757e-4583-a5ef-b60ad7e3899f", "name": "GamerRenamed", "role": "owner", "score": 200188 } ],
  "next_cursor": "YzM"
}
```

### Clan Applications

```http
GET /app/v1/clan/applications?cursor=&limit=
```

`krunker.app(accessToken).clan.applications({ cursor, limit })`

Pending join requests, oldest first (paged). Officers only: `403 not_clan_officer` otherwise, `404 not_found` without a clan.

**Response:**

```json
{ "data": [ { "sub": "557a7808-dc59-4825-8a8d-172497f0675f", "name": "newplayer" } ] }
```

---

## Notifications

Scope `notifications:read`.

### List Notifications

```http
GET /app/v1/notifications?unread=&cursor=&limit=
```

`krunker.app(accessToken).notifications.list({ unread, cursor, limit })`

The player's Krunker Mail, newest first (paged). Reading through the API never marks mail as read. `?unread=true` returns unread mail only.

**Response:**

```json
{
  "data": [
    { "notification_id": 16507007, "category": "inbox", "subject": "Item sold",
      "text": "bananas purchased your item for 20 KR!", "link": "bananas",
      "from": { "name": "Krunker", "system": true }, "read": false,
      "sent_at": "2026-11-03T17:40:13Z" },
    { "notification_id": 16507014, "category": "followers", "subject": "Hello", "text": "...", "link": "GamerRenamed",
      "from": { "sub": "21054d5f-757e-4583-a5ef-b60ad7e3899f", "name": "GamerRenamed", "system": false },
      "read": true, "sent_at": "2026-11-06T22:42:12Z", "read_at": "2026-11-06T22:42:12Z" }
  ],
  "next_cursor": "YzE2NTA3MDE0"
}
```

- `category` matches the in-game mail tabs: `followers`, `clan`, `hub` or `inbox`.
- `from.system` is true for mail from Krunker, which has no `sub`. A sender whose account no longer exists is `{ "name": "Unknown", "system": false }`.
- `link` is the game's own reference for the mail (often a player or clan name).

### Unread Count

```http
GET /app/v1/notifications/count
```

`krunker.app(accessToken).notifications.count()`

**Response:**

```json
{ "data": { "unread": 98 } }
```

---

## Direct Messages

Scopes: `dms:read` to read conversations and messages, `dms:write` to send as the player (it includes `dms:read`). Krunker keeps DMs for 30 days. Messages sent through any app carry `via` (the app's name), and the game shows them to both players as "via \<app\>".

### Conversations

```http
GET /app/v1/dms?cursor=&limit=
```

`krunker.app(accessToken).dms.conversations({ cursor, limit })`

The player's conversations, newest first. `limit` is 1 to 50 (default 20; higher values are lowered to 50, krapio refuses them before the request), `cursor` is the previous page's `next_cursor`. `unread` counts messages from the peer the player hasn't read in game. Reading through the API never marks anything read.

**Response:**

```json
{
  "data": [
    {
      "peer": { "sub": "21054d5f-757e-4583-a5ef-b60ad7e3899f", "name": "GamerRenamed" },
      "unread": 0,
      "last_message": { "message_id": 179, "from_me": true, "text": "ready for scrims?", "sent_at": "2026-11-06T22:37:01.297Z", "read": false, "via": "My Tracker" }
    }
  ],
  "next_cursor": "152"
}
```

### Messages

```http
GET /app/v1/dms/:sub?cursor=&limit=
```

`krunker.app(accessToken).dms.messages(sub, { cursor, limit })`

Messages with one player, newest first; `cursor` pages to older messages. `read` says whether the recipient has read the message. Note that `peer` is next to `data`, so krapio returns the whole body here.

**Response:**

```json
{
  "peer": { "sub": "21054d5f-757e-4583-a5ef-b60ad7e3899f", "name": "GamerRenamed" },
  "data": [
    { "message_id": 180, "from_me": false, "text": "sure", "sent_at": "2026-11-06T22:37:13.275Z", "read": true },
    { "message_id": 179, "from_me": true, "text": "ready for scrims?", "sent_at": "2026-11-06T22:37:01.297Z", "read": true, "via": "My Tracker" }
  ],
  "next_cursor": "179"
}
```

### Sending a Message

Scope `dms:write`, a write, not in krapio. `POST /app/v1/dms/:sub` with the body `{ "text": "..." }`; send `X-Idempotency-Key` as with other writes.

The rules of the game apply: the recipient must be a friend (mutual follow, or a conversation in the last 30 days), the text is 1 to 512 bytes of UTF-8 (trimmed), and the player's own send rate (5 messages per 15 seconds, shared with the game) applies. Each app can also send at most 10 messages per minute and 200 per day per player.

```json
{ "data": { "message_id": 181, "from_me": true, "text": "gg", "sent_at": "2026-11-06T22:40:02.469Z", "read": false, "via": "My Tracker" } }
```

The message is delivered live to the recipient and to the player's open game clients, labelled "via \<app\>".

| Status | `code` | When |
| --- | --- | --- |
| 400 | `invalid_request` | Bad `limit` or `cursor`, body not JSON, empty or invalid text |
| 400 | `text_too_long` | Text over 512 bytes |
| 403 | `not_friends` | The recipient isn't a friend of the player |
| 404 | `not_found` | `:sub` isn't a player known to your app, or is the player themself |
| 429 | `rate_limited` | The player is sending too fast (`Retry-After: 15`), or a general limit |
| 429 | `dm_limit_reached` | Your app's per-player DM limit; `Retry-After` says when the next send fits |
| 503 | `temporarily_unavailable` | Messaging is down; try again later |

---

## Acting for the player

None of this is in krapio. The library sends no write on any tier; the endpoints are documented so the whole API is in one place, and the body and reply types are exported (`AppListBody`, `AppListResult`, `AppCreateTradeBody`, ...). Every path below is under `/app/v1`.

Write endpoints run the same rules as the game: level gates, fees, cooldowns, bans, locks, and market and trade limits. Every call is recorded in the player's app activity.

| Scope | Endpoints |
| --- | --- |
| `market:write` | List, bulk list, unlist, buy, buy several |
| `trades:write` | Create, accept, cancel or decline, decline all |
| `inventory:write:skins` | Quick-sell, bulk quick-sell, paint, style, lock |
| `inventory:write:currency` | Send KR |
| `friends:write` | Follow, unfollow |
| `dms:write` | Send a DM (see [Sending a Message](#sending-a-message)) |

- **Balances:** responses that change the player's money include `kr` (KR after the call) and, for quick-sells, `junk`.
- **Players** in inputs (`to`, `:sub`) are subject ids.
- **Items:** a single copy is addressed by `instance_id` (and its `skin_index`), a stack by `skin_index` and `count`, exactly as `GET /app/v1/inventory/items` shows them.

### Locked items

Players lock items in game to keep them safe. Apps can never use a locked item: listing, quick-selling, painting (including with a locked paint), styling and trading it are refused with `422 item_locked`. When you name an item without an `instance_id`, the call is refused if **any** copy of it is locked, so pass `instance_id` to use an unlocked copy. Apps can lock items but never unlock them.

### Idempotency

Send `X-Idempotency-Key: <uuid>` on every write (up to 255 characters).

- A retry with the same key (same method and path, same app and player) within 24 hours returns the stored response instead of running again, with the header `Idempotent-Replayed: true`.
- While the first request is still running, a retry gets `409 idempotency_in_progress`.
- `429` and `5xx` responses aren't stored, so you can retry them with the same key. A `500 server_error` is safe to retry with the same key.
- Use a new key for every new action.
- The key doesn't apply to approval requests (`Krunker-Approval: request`): each one creates a new action.

### Market (`market:write`)

The player needs level 10 (`market_level_too_low`). Listing charges the game's listing fee (currently 10% of the price), which isn't refunded on unlist.

| Request | Body | Reply `data` |
| --- | --- | --- |
| `POST /market/listings` | `{skin_index, instance_id?, price}` | `{listing_id, skin_index, instance_id?, price, kr}` |
| `POST /market/listings/bulk` | `{items: {skin_index, instance_id?, price, count?}[]}` | `{listed, kr, results: {skin_index, instance_id?, listed, listing_ids}[]}` |
| `DELETE /market/listings/:listing_id` | none | `{listing_id, unlisted: true}` |
| `POST /market/purchase` | `{listing_id, max_price}` | `{listing_id, skin_index, instance_id?, price, kr}` |
| `POST /market/buy-multiple` | `{skin_index, count, max_total}` | `{skin_index, bought, spent, kr, instance_ids}` |

**List an item.** For a non-stackable item `instance_id` is optional (an unlisted copy is picked); pass it when the player has several copies. For a stackable item send only `skin_index` and `price`; one unit is listed, and the reply has no `instance_id`.

```json
{ "skin_index": 7820, "instance_id": 200000470, "price": 500 }
```

```json
{ "data": { "listing_id": 30002326, "skin_index": 7820, "instance_id": 200000470, "price": 500, "kr": 525359 } }
```

**List several items.** Up to 100 units per call. `count` (default 1) lists that many units of a stackable item. Entries are independent: one failing doesn't undo the others, but account-wide refusals (listing cap, KR for the fee, level) stop the run. A locked item in any entry refuses the whole call. An entry that failed has `"listed": 0` plus `error` and `code` (for example `market_price_too_low`).

```json
{
  "items": [
    { "skin_index": 7820, "instance_id": 200000470, "price": 500 },
    { "skin_index": 7777, "price": 300, "count": 2 }
  ]
}
```

```json
{
  "data": {
    "listed": 3,
    "kr": 525655,
    "results": [
      { "skin_index": 7820, "instance_id": 200000470, "listed": 1, "listing_ids": [30002333] },
      { "skin_index": 7777, "listed": 2, "listing_ids": [30002331, 30002332] }
    ]
  }
}
```

**Unlist.** `404 not_found` if the listing isn't the player's or was already taken down; `422 market_listing_gone` if it already sold.

```json
{ "data": { "listing_id": 30002326, "unlisted": true } }
```

**Buy a listing.** `max_price` is required: the price you showed the player. If the listing now costs more, the call fails with `market_price_changed`. A listing that sold or doesn't exist is `422 market_listing_gone`. `instance_id`, the copy received, is omitted for stackable items.

```json
{ "listing_id": 24971780, "max_price": 41 }
```

```json
{ "data": { "listing_id": 24971780, "skin_index": 7820, "instance_id": 200107967, "price": 41, "kr": 525709 } }
```

**Buy several of one item.** Buys the cheapest `count` listings of an item (1 to 1000) in one transaction, all or nothing. `max_total` is the total you showed the player; if the cheapest listings now cost more, nothing is bought (`market_price_changed`). `instance_ids` lists the copies received for non-stackable items.

```json
{ "skin_index": 2583, "count": 2, "max_total": 300 }
```

```json
{ "data": { "skin_index": 2583, "bought": 2, "spent": 300, "kr": 525409, "instance_ids": [] } }
```

### Trades (`trades:write`)

Both players need level 10 (`trade_level_too_low`). The game's item caps (5 per side, 20 for premium) and trade fee apply; the fee is charged to the player who creates the trade and is waived for premium players.

| Request | Body | Reply `data` |
| --- | --- | --- |
| `POST /trades` | `{to, give: {skin_index, instance_ids? \| count?}[], receive: [...], message?}` | `{trade_id, to: {sub, name}, kr}` |
| `POST /trades/:trade_id/accept` | none | `{trade_id, accepted: true, kr}` |
| `POST /trades/:trade_id/cancel` | none | `{trade_id, cancelled: true}` |
| `POST /trades/decline-all` | none | `{declined: true}` |

**Create a trade.** `give` is what the player offers and `receive` what they ask for. For a non-stackable item pin copies with `instance_ids`, or give a `count` and the game picks the copies; for a stackable item give a `count`. `message` is up to 500 bytes.

```json
{
  "to": "21054d5f-757e-4583-a5ef-b60ad7e3899f",
  "give": [{ "skin_index": 7822, "instance_ids": [200000484] }],
  "receive": [{ "skin_index": 7776, "count": 2 }],
  "message": "gg"
}
```

```json
{ "data": { "trade_id": 8880926, "to": { "sub": "21054d5f-757e-4583-a5ef-b60ad7e3899f", "name": "GamerRenamed" }, "kr": 525357 } }
```

**Accept** takes a trade offered **to** the player.

```json
{ "data": { "trade_id": 8880927, "accepted": true, "kr": 525357 } }
```

**Cancel** cancels the player's own offer or declines one made to them.

```json
{ "data": { "trade_id": 8880926, "cancelled": true } }
```

**Decline all** declines every incoming trade.

```json
{ "data": { "declined": true } }
```

### Items (`inventory:write:skins`)

| Request | Body | Reply `data` |
| --- | --- | --- |
| `POST /inventory/quick-sell` | `{skin_index, instance_id?, action, amount?}` | `{skin_index, remaining, kr, junk}` |
| `POST /inventory/quick-sell/bulk` | `{action, items: {instance_id, skin_index}[]}` | `{sold: number[], skipped: {instance_id, reason}[], kr, junk}` |
| `POST /inventory/items/:instance_id/paint` | `{skin_index, paint_skin_index}` | `{instance_id, paint \| paint_shader, paint_remaining}` |
| `POST /inventory/items/:instance_id/style` | `{skin_index, style}` | `{instance_id, style}` |
| `POST /inventory/locks` | `{instance_id}` or `{skin_index}` | `{skin_index, instance_id?, locked: true}` |

**Quick-sell** sells an item back to Krunker. The player needs level 10.

```json
{ "skin_index": 7820, "instance_id": 200000481, "action": "kr", "amount": "one" }
```

```json
{ "data": { "skin_index": 7820, "remaining": 21, "kr": 525369, "junk": 1189.94 } }
```


- `action`: `"kr"` or `"junk"` (the item must have a value in that currency), or `"destroy"` (only for items with no value).
- `amount`: `"one"` (default), `"all_but_one"` or `"all"`.
- `instance_id`: the copy to sell, for `"one"` on a non-stackable item. For stackable items send only `skin_index` (an `instance_id` is `400 invalid_request`).
- `remaining` is how many copies the player still has.

**Quick-sell many copies** takes up to 250 non-stackable copies in one transaction. The `reason` of a skipped copy is `not_owned`, `no_value` or `unavailable` (listed or stackable).

```json
{ "action": "kr", "items": [{ "instance_id": 200000487, "skin_index": 7821 }] }
```

```json
{ "data": { "sold": [200000487], "skipped": [{ "instance_id": 999, "reason": "not_owned" }], "kr": 525379, "junk": 1189.94 } }
```

**Paint** uses one paint from the player's inventory. Shader paints return `paint_shader` (a number) instead of `paint`.

```json
{ "skin_index": 7793, "paint_skin_index": 7776 }
```

```json
{ "data": { "instance_id": 200000343, "paint": "#dc3c3c", "paint_remaining": 43 } }
```

**Pick a style.**

```json
{ "skin_index": 7794, "style": 1 }
```

```json
{ "data": { "instance_id": 200000344, "style": 1 } }
```

**Lock** takes `{ "instance_id": 200000345 }` for a copy, or `{ "skin_index": 7779 }` for a stackable item (locks the whole stack). An item listed on the market can't be locked (`item_listed`).

```json
{ "data": { "skin_index": 7793, "instance_id": 200000345, "locked": true } }
```

### Send KR (`inventory:write:currency`)

`POST /inventory/gift`

```json
{ "to": "21054d5f-757e-4583-a5ef-b60ad7e3899f", "amount": 10, "message": "for the trade" }
```

The minimum is 10 KR, and the sender also pays the game's 10% fee. `message` is up to 300 characters and goes into the recipient's Krunker Mail.

```json
{ "data": { "to": { "sub": "21054d5f-757e-4583-a5ef-b60ad7e3899f", "name": "GamerRenamed" }, "amount": 10, "kr": 525368 } }
```

### Follow (`friends:write`)

`PUT /friends/following/:sub` follows a player; `DELETE /friends/following/:sub` unfollows.

```json
{ "data": { "sub": "21054d5f-757e-4583-a5ef-b60ad7e3899f", "name": "GamerRenamed", "following": true } }
```

---

## Per-action approval

Instead of holding a write scope, an app can ask the player to approve **one** write at a time. This is how **public clients** (read scopes only) can act, and an option for confidential apps that only act now and then. Your app still needs the Krunker team's approval for the endpoint's scope; the player's grant doesn't need to include it.

Requesting an approval is a write, so krapio does not send it. It does read the outcome ([Action Status](#action-status)) and the redirect back (`parseCallback`).

Supported endpoints:

- `POST /market/listings`, `DELETE /market/listings/:listing_id`, `POST /market/purchase`
- `POST /trades`, `POST /trades/:trade_id/accept`, `POST /trades/:trade_id/cancel`
- `POST /inventory/gift`
- `PUT /friends/following/:sub`, `DELETE /friends/following/:sub`

Every other write endpoint (bulk endpoints, quick-sell, paint, style, locks, decline all, DMs) answers `400 approval_unavailable` to the approval header.

### 1. Request the action

Call the endpoint exactly as usual, with these headers added:

| Header | Required | Description |
| --- | --- | --- |
| `Krunker-Approval` | yes | `request` |
| `Krunker-Approval-Redirect` | no | One of your registered redirect URIs (exact match), where the player comes back afterwards |
| `Krunker-Approval-State` | with a redirect | Your random value (1 to 500 characters), returned unchanged |

Krunker runs some checks right away (for example that the item exists and isn't locked, that the listing exists and is within `max_price`, that the player is part of the trade, that the recipient exists and isn't the player) and answers **202 Accepted**, with `Location` set to `approve_url` (`AppActionRequest` in krapio):

```json
{
  "data": {
    "action_id": "act_6Hc2...",
    "status": "pending",
    "approve_url": "https://krunker.io/oauth/authorize?action=act_6Hc2...",
    "expires_at": "2026-11-07T00:01:01Z"
  }
}
```

The full game rules (level, balance, ownership, ...) run when the player approves.

### 2. Send the player to `approve_url`

Krunker shows exactly that action in plain words ("Unfollow GamerRenamed", "List AK Ruby for 1,200 KR", ...) and asks for the player's 2FA code. Only the player the token belongs to can approve it; signed in as someone else, they are told it's for another account. It expires after **10 minutes**, runs at most once, and is refused if the player has disconnected your app.

### 3. The player comes back

On approval, Krunker runs the request once, as the player, through the same endpoint. With a redirect, the player then returns to:

```text
https://example.com/callback?action_id=act_6Hc2...&state=...&status=approved
```

`status` is `approved`, `denied` or `failed`. Check `state`, and treat `status` as a hint only. `parseCallback(url, expectedState)` returns this as `{ kind: "action", actionId, status }`.

### Action Status

```http
GET /app/v1/actions/:action_id
```

`krunker.app(accessToken).actions.get(actionId)`

The outcome of an action, with any valid token of the same player and app.

**Response:**

```json
{
  "data": {
    "action_id": "act_6Hc2...",
    "type": "follow.remove",
    "status": "approved",
    "summary": { "type": "follow.remove", "peer": "GamerRenamed" },
    "created_at": "2026-11-06T23:51:01Z",
    "expires_at": "2026-11-07T00:01:01Z",
    "decided_at": "2026-11-06T23:51:40Z",
    "result_status": 200,
    "result": { "data": { "sub": "21054d5f-757e-4583-a5ef-b60ad7e3899f", "name": "GamerRenamed", "following": false } }
  }
}
```

| `status` | Meaning |
| --- | --- |
| `pending` | Waiting for the player |
| `approved` | It ran and succeeded; `result` is the body the direct call would have returned |
| `failed` | It ran and the endpoint refused it; `result` holds the normal error body and `result_status` its HTTP status |
| `denied` | The player declined |
| `expired` | Nobody approved it within 10 minutes |

Actions are kept for 24 hours after they are created or decided. `result_status` and `result` are absent until the action has run.

Errors specific to approval requests:

| Status | `code` | When |
| --- | --- | --- |
| 400 | `approval_unavailable` | The endpoint doesn't support approval |
| 400 | `invalid_redirect_uri` | `Krunker-Approval-Redirect` isn't one of your redirect URIs |
| 400 | `invalid_request` | `Krunker-Approval` isn't `request`, or the state is missing or too long |
| 403 | `insufficient_scope` | Your app isn't approved for the endpoint's scope |
| 413 | `invalid_request` | The body is over 16 KB |
| 429 | `rate_limited` | More than 20 approval requests in 10 minutes for this player (`Retry-After: 600`) |

---

## Webhooks

An app with `events:subscribe` can get a signed HTTP POST when something happens to a player who authorised it. Each event is about **one player** your app acts for. Players only ever appear as your app's subject ids, plus the public name of other players. Events are signals: they carry ids, not content; fetch the details with the read endpoints.

These are not the webhooks of the [developer API](developer-api.md#webhooks): those belong to a developer key and carry public events (`map.featured`), these belong to an app and carry a player's events. The headers and the signature are the same, so `verifyWebhook` checks both.

### Setup

1. Request `events:subscribe` for your app on its page; the Krunker team reviews it.
2. Open **Manage webhook** on the app page and create the webhook: an `https://` URL (public host, up to 500 characters) and the event types you want. The signing secret `whsec_...` is shown **once**.
3. Click **Verify**. Krunker sends 10 `webhook.verify` POSTs in random order, some correctly signed and some not. Correctly signed ones must get a 2xx and the others a `401`. The check stops at the first wrong answer, and nothing is delivered until it passes.
4. Players authorise your app with `events:subscribe` **and** the read scope of each event type you want for them. Players can untick scopes, so you may get some types for some players only.

Each app has one webhook. You can turn it off and on, send a `webhook.test` event, rotate the secret and see the last 50 deliveries with **Redeliver**. Rotating the secret needs a new Verify; changing the URL starts a new check.

### Event types

| Type | When | Player scope needed (besides `events:subscribe`) | `data` |
| --- | --- | --- | --- |
| `trade.received` | Someone sent the player a trade offer | `trades:read` or `trades:write` | `trade_id`, `from` |
| `trade.completed` | A trade of the player went through (either side, or an in-game direct trade) | `trades:read` or `trades:write` | `trade_id`, `partner` |
| `market.sold` | One of the player's listings sold | `market:read` or `market:write` | `listing_id`, `skin_index`, `price` (KR), `buyer` |
| `dm.received` | The player received a DM | `dms:read` or `dms:write` | `message_id`, `from` |
| `friend.followed` | Someone followed the player | `friends:read` or `friends:write` | `follower` |
| `notification.received` | The player got Krunker Mail or a system notice | `notifications:read` | `notification_id`, `system`, `from` (player mail only) |
| `grant.revoked` | The player disconnected your app, Krunker revoked it, or the account was deleted | none (sent whenever the grant had `events:subscribe`) | `reason`: `player`, `staff` or `deleted` |

`from`, `partner`, `buyer` and `follower` are `{ "sub": "...", "name": "..." }`. To get the details:

| Event | Fetch with | Match on |
| --- | --- | --- |
| `trade.received`, `trade.completed` | `GET /app/v1/trades` (`open` or `completed`) | `trade_id` |
| `market.sold` | `GET /app/v1/market/history` (side `sold`) | `listing_id` |
| `dm.received` | `GET /app/v1/dms/:sub` with `from.sub` | `message_id` |
| `friend.followed` | `GET /app/v1/friends/followers` | `follower.sub` |
| `notification.received` | `GET /app/v1/notifications` | `notification_id` |

After `grant.revoked` your tokens for that player stop working. The subject stays the same if the player connects your app again. With reason `deleted`, delete what you stored about that player.

### Delivery

`POST` to your URL with `Content-Type: application/json` and `User-Agent: Krunker-Webhooks/1.0`:

```json
{
  "id": 8,
  "type": "dm.received",
  "created_at": "2026-11-06T22:47:56Z",
  "sub": "b3c35209-38a9-44dc-8c2b-733e9ffcbba7",
  "data": {
    "from": { "sub": "72abe052-1ef8-40b6-b0c4-efc03519e69c", "name": "GamerRenamed" },
    "message_id": 182
  }
}
```

- `id` is the event id, unique per event in your app. Retries and redeliveries repeat it, so use it to de-duplicate. `sub` is the player the event is about.
- `webhook.test` has `id` 0, no `sub` and a `data.message`. It is sent once, without retries.
- Headers: `Krunker-Event-Id`, `Krunker-Event-Type`, `Krunker-Delivery-Id`, `Krunker-Delivery-Attempt` and `Krunker-Signature`.
- Answer with a 2xx within 10 seconds. Redirects aren't followed.
- Order isn't guaranteed; use `created_at` and the ids.

### Verifying signatures

```text
Krunker-Signature: t=1762469276,v1=5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8bd
```

`v1` is the hex HMAC-SHA256 of `"<t>.<raw body>"` with your signing secret as the key. Compute it over the **raw** body bytes (before any JSON parsing), compare in constant time, reject old `t` values (for example older than 5 minutes), and answer `401` when it doesn't match.

In krapio that is `verifyWebhook`, and the parsed body is an `AppWebhookEvent`, a union that narrows on `type`:

```ts
import { verifyWebhook, WEBHOOK_HEADERS, type AppWebhookEvent } from "krapio";

const raw = await request.text();
if (!await verifyWebhook(raw, request.headers.get(WEBHOOK_HEADERS.signature), process.env.KRUNKER_WEBHOOK_SECRET!)){
    return new Response("bad signature", { status: 401 }); // the Verify check expects exactly this
}
const event = JSON.parse(raw) as AppWebhookEvent;
if (event.type === "market.sold") console.log(event.sub, event.data.listing_id, event.data.price);
return new Response(null, { status: 204 });
```

### Retries and auto-disable

- A delivery that doesn't get a 2xx is retried after 30 s, 2 min, 10 min, 30 min, 1 h, 2 h, 4 h, 8 h and 8 h: 10 attempts over about a day.
- If deliveries keep failing for that long with no success, the webhook is turned off and you get a Krunker Mail. Fix the endpoint and turn it back on; it is verified again.
- Before each attempt Krunker checks again that the player still grants the scopes and isn't banned; if not, the delivery is cancelled.
- Events are kept 30 days. Events that happen while the webhook is off or not verified, or the app is suspended, aren't queued for it.

---

## Errors

App API errors are `{ "error": { "code": "...", "message": "..." } }`. The token and revoke endpoints use the OAuth format instead (see [Token endpoint errors](#token-endpoint-errors)).

| Status | `code` | When |
| --- | --- | --- |
| 400 | `invalid_request` | A malformed body or parameter (`limit`, `cursor`, `status`, `season`, ...) |
| 400 | `approval_unavailable` | Per-action approval isn't supported on this endpoint |
| 400 | `invalid_redirect_uri` | An approval redirect that isn't registered |
| 400 | `text_too_long` | A DM over 512 bytes |
| 401 | `invalid_token` | Missing, malformed, expired or revoked token; app suspended; player banned or disconnected the app |
| 403 | `insufficient_scope` | The token (or, for approvals, your app) lacks the endpoint's scope |
| 403 | `not_clan_officer` | Clan applications for a player who isn't an officer |
| 403 | `not_friends` | A DM to someone who isn't the player's friend |
| 404 | `not_found` | Unknown subject, listing, trade, action or player; no clan |
| 409 | `busy` | The player's account is busy with another action; retry after `Retry-After` (10 s) |
| 409 | `idempotency_in_progress` | A request with the same idempotency key is still running |
| 413 | `invalid_request` | An approval request body over 16 KB |
| 422 | `item_locked` | The request touches an item the player locked |
| 422 | game codes | A game rule refused it (below) |
| 422 | `rejected` | Any other game refusal; read `message` |
| 429 | `rate_limited` | Over a rate limit; see `Retry-After` |
| 429 | `dm_limit_reached` | Your app's per-player DM limit |
| 500 | `server_error` | Our side failed. Writes are safe to retry with the same idempotency key |
| 503 | `temporarily_unavailable` | A dependency is down; retry later |

Game codes (status 422) you may see on writes:

| Area | Codes |
| --- | --- |
| Items and KR | `item_not_owned`, `item_listed`, `insufficient_funds`, `self_target` |
| Market | `market_disabled`, `market_maintenance`, `market_busy`, `market_rate_limited`, `market_level_too_low`, `market_invalid_account`, `market_insufficient_funds`, `market_item_not_found`, `market_item_not_owned`, `market_item_not_sellable`, `market_item_already_listed`, `market_item_already_sold`, `market_listing_gone`, `market_self_purchase`, `market_max_items`, `market_price_too_low`, `market_price_too_high`, `market_price_changed`, `market_not_enough_listings` |
| Quick-sell | `market_quick_sell_not_sellable`, `market_quick_sell_no_value`, `market_quick_sell_invalid_action`, `market_quick_sell_invalid_amount`, `market_quick_sell_failed` |
| Trades | `trade_level_too_low`, `trade_player_not_found`, `trade_invalid_offer`, `trade_message_too_long`, `trade_max_items_exceeded`, `trade_item_not_owned`, `trade_item_not_tradable`, `trade_proc_error` |
| Paint and style | `items_paint_not_owned`, `items_paint_invalid_type`, `items_paint_no_color`, `items_paint_def_missing`, `items_paint_insufficient`, `items_paint_target_invalid`, `items_style_target_invalid`, `items_style_invalid_index` |

New codes can be added; treat an unknown 422 code like `rejected`.

In krapio:

| Status | Error | Notes |
| --- | --- | --- |
| 400 | `KrunkerBadRequestError` | |
| 401 | `KrunkerUnauthorizedError` | the token is dead: refresh, or sign the player in again |
| 403 | `KrunkerForbiddenError` | `err.code` tells `insufficient_scope` from `not_clan_officer` |
| 404 | `KrunkerNotFoundError` | |
| 429 | `KrunkerRateLimitError` | `retryAfter` from `Retry-After` |
| 5xx | `KrunkerServerError` | retried once for reads |
| 409, 422 | `KrunkerHttpError` | writes only |

---

## A minimal app

A confidential client on [Bun](https://bun.sh) with krapio: sign-in with PKCE and state, the code exchange, reads with a refresh before the token runs out, logout with revocation and signed webhooks. Register an app with the redirect URI `http://localhost:8787/callback` (it works while the app is in dev mode), then run:

```sh
KRUNKER_CLIENT_ID=kapp_... KRUNKER_CLIENT_SECRET=kas_... bun server.ts
```

```ts
import { Krunker, KrunkerOAuthError, KrunkerUnauthorizedError, createPkce, createState, parseCallback, verifyWebhook, type AppSession, type AppWebhookEvent, type OAuthTokens } from "krapio";

const krunker = new Krunker({
    userAgent: "my-app/1.0",
    app: { clientId: process.env.KRUNKER_CLIENT_ID!, clientSecret: process.env.KRUNKER_CLIENT_SECRET!, redirectUri: "http://localhost:8787/callback" },
});

type Stored = OAuthTokens & { expires_at: number };
const pending = new Map<string, string>();  // state -> PKCE verifier
const sessions = new Map<string, Stored>(); // your session id -> tokens
const stamp = (tokens: OAuthTokens): Stored => ({ ...tokens, expires_at: Date.now() + tokens.expires_in * 1000 });

/** the app api for a session, refreshed first when the access token is about to run out */
async function appFor(sid: string): Promise<AppSession> {
    let tokens = sessions.get(sid)!;
    if (Date.now() > tokens.expires_at - 60_000){
        tokens = stamp(await krunker.oauth.refresh(tokens.refresh_token));
        sessions.set(sid, tokens); // the old refresh token is now spent
    }
    return krunker.app(tokens.access_token);
}

Bun.serve({
    port: 8787,
    async fetch(req){
        const url = new URL(req.url);
        const sid = /(?:^|;\s*)sid=([\w-]+)/.exec(req.headers.get("cookie") ?? "")?.[1];

        // 1. send the player to the consent page
        if (url.pathname === "/login"){
            const state = createState();
            const pkce = await createPkce();
            pending.set(state, pkce.verifier);
            return Response.redirect(krunker.oauth.authorizeUrl({ scope: ["profile", "stats:read", "friends:read"], state, codeChallenge: pkce.challenge }), 302);
        }

        // 2. back from Krunker: check state, exchange the code
        if (url.pathname === "/callback"){
            const state = url.searchParams.get("state") ?? "";
            const verifier = pending.get(state);
            pending.delete(state);
            if (!verifier) return new Response("Unknown or expired login attempt", { status: 400 });
            try {
                const callback = parseCallback(url, state);
                if (callback.kind !== "code") return new Response("Not a login", { status: 400 });
                const tokens = await krunker.oauth.exchangeCode({ code: callback.code, codeVerifier: verifier });
                const newSid = createState();
                sessions.set(newSid, stamp(tokens));
                return new Response(null, { status: 302, headers: { Location: "/", "Set-Cookie": `sid=${newSid}; HttpOnly; SameSite=Lax; Path=/` } });
            }
            catch (err){
                if (err instanceof KrunkerOAuthError) return new Response(`Login cancelled: ${err.error}`);
                throw err;
            }
        }

        // 3. log out: revoke the refresh token (and with it the sign-in) and the current access token
        if (url.pathname === "/logout" && req.method === "POST" && sid && sessions.has(sid)){
            const tokens = sessions.get(sid)!;
            sessions.delete(sid);
            await krunker.oauth.revoke(tokens.refresh_token);
            await krunker.oauth.revoke(tokens.access_token);
            return Response.redirect("/", 303);
        }

        // 4. webhooks: 401 for a bad signature, which is also what the Verify check tests
        if (url.pathname === "/webhook" && req.method === "POST"){
            const raw = await req.text();
            if (!await verifyWebhook(raw, req.headers.get("Krunker-Signature"), process.env.KRUNKER_WEBHOOK_SECRET!)){
                return new Response("bad signature", { status: 401 });
            }
            const event = JSON.parse(raw) as AppWebhookEvent;
            if (event.type !== "webhook.verify") console.log(event.id, event.type, event.data);
            return new Response(null, { status: 204 });
        }

        // 5. show the player
        if (url.pathname === "/" && sid && sessions.has(sid)){
            try {
                const me = await appFor(sid);
                const { data: player } = await me.player.me();
                const following = await me.friends.following({ limit: 5 });
                return Response.json({ player, following: following.data });
            }
            catch (err){
                if (!(err instanceof KrunkerUnauthorizedError)) throw err;
                sessions.delete(sid); // disconnected, banned or app suspended
                return Response.redirect("/login", 302);
            }
        }
        return new Response("<a href=\"/login\">Login with Krunker</a>", { headers: { "Content-Type": "text/html" } });
    },
});
```

Krunker's own document has the same app without a library, on `fetch` and `node:crypto`.
