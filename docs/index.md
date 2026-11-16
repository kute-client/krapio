---
title: Overview
description: What krapio covers and how the four Krunker APIs relate
---

krapio is a typed client for the Krunker.io APIs with zero dependencies, for Node 20+ and Bun. These pages document the APIs themselves; the [library reference](reference/index.md) is generated from the source, and so is the [OpenAPI document](https://nulldev.github.io/krapio/openapi/) (raw: [openapi.json](https://nulldev.github.io/krapio/openapi.json)) that lists every endpoint of the four tiers.

| Tier | What | Auth | On the client |
| --- | --- | --- | --- |
| [Developer API](developer-api.md) | the documented developer API (`gapi.svc.krunker.io/api/*`), corrected against the live service | `X-Developer-API-Key` | the root: `krunker.player`, `krunker.market`, ... |
| [Game API](game-api.md) | what the game itself reads without any auth: market, Turf Wars, clans, social, shop, matchmaker | none | `krunker.game.*` |
| [Token API](token-api.md) | what the game reads with the player's own FRVR token: wallet, inventory, trades, ranked | `Authorization: Bearer <jwt>` | `krunker.as(token).*` |
| [App API](app-api.md) | Login with Krunker: OAuth 2.0 and what a player lets an app read (stats, inventory, trades, friends, DMs, ...) | `Authorization: Bearer kat_...` from an OAuth sign-in | `krunker.oauth.*`, `krunker.app(accessToken).*` |

```ts
import { Krunker } from "krapio";

const krunker = new Krunker({ apiKey: process.env.KRUNKER_API_KEY, userAgent: "my-bot/1.0" });

await krunker.player.profile("NulPing");              // developer api
await krunker.game.market.stats({ sort: "rarity" });   // game api
await krunker.as(playerToken).player.wallet();         // token api
await krunker.app(accessToken).stats.get();            // app api, after an oauth sign-in
```

Reads only. Every write (buying, listing, trading, posting), of the game API and of the app API alike, is left out on purpose; the OAuth token calls are the only POSTs the library sends. The library caches nothing, put your own cache in front of it.

```sh
bun add krapio
# or
npm install krapio
```

## How these documents were made

The developer API page is the document Krunker (FRVR) provides to key holders, with every difference found by calling the endpoints marked *observed* or *undocumented*. The app API page is Krunker's Login with Krunker document from November 2026, with krapio's side added; only what answers without credentials was checked. The game and token pages have no original: they were written from the game's client code and from live replies, one unauthenticated or one token bound `GET` per endpoint, in October 2026. None of those two is documented or supported by Krunker and all of it can change without notice.
