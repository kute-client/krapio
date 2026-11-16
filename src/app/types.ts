// ========================= //
// = Copyright (c) NullDev = //
// =     - SPDX: MIT -     = //
// ========================= //

// shapes of Login with Krunker: the oauth endpoints and the app api (gapi.svc.krunker.io/app/v1), from Krunker's document.
// the write bodies and results at the end are shapes only, krapio sends no write

/* ---------- oauth ---------- */

/** every scope of the discovery document; a write scope includes its read scope, `profile` is always granted */
export const APP_SCOPES = [
    "profile",
    "stats:read",
    "notifications:read",
    "inventory:read",
    "inventory:write:skins",
    "inventory:write:currency",
    "inventory:write",
    "trades:read",
    "trades:write",
    "market:read",
    "market:write",
    "friends:read",
    "friends:write",
    "dms:read",
    "dms:write",
    "clan:read",
    "maps:read",
    "events:subscribe",
] as const;

/** a scope of an app; everything but `profile` needs approval by the Krunker team */
export type AppScope = typeof APP_SCOPES[number];

/** GET /.well-known/oauth-authorization-server (RFC 8414) */
export type OAuthDiscovery = {
    issuer: string;
    authorization_endpoint: string;
    token_endpoint: string;
    revocation_endpoint: string;
    userinfo_endpoint: string;
    scopes_supported: string[];
    response_types_supported: string[];
    grant_types_supported: string[];
    code_challenge_methods_supported: string[];
    token_endpoint_auth_methods_supported: string[];
};

/** the reply of POST /oauth/token, for a code exchange and for a refresh */
export type OAuthTokens = {
    /** `kat_...`, opaque, good for `expires_in` seconds */
    access_token: string;
    token_type: "Bearer";
    /** seconds, 3600 */
    expires_in: number;
    /** `krt_...`, works once: every refresh answers with a new one */
    refresh_token: string;
    /** space separated, what the player actually granted; can be less than what was asked for */
    scope: string;
    /** the player's subject id in this app */
    sub: string;
};

/** the error body of the oauth endpoints */
export type OAuthErrorBody = {
    error: "invalid_grant" | "unsupported_grant_type" | "invalid_client" | "server_error" | "temporarily_unavailable" | (string & {});
    error_description?: string;
};

/** the `error` a redirect back from the consent page can carry */
export type OAuthCallbackError = "access_denied" | "invalid_request" | "invalid_scope" | "unsupported_response_type" | (string & {});

/* ---------- envelopes ---------- */

/** a single object of the app api */
export type AppReply<T> = {
    data: T;
};

/** a list of the app api; pass `next_cursor` back as `cursor` while it is present, a page can be shorter than the limit */
export type AppPage<T> = {
    data: T[];
    /** opaque, absent on the last page */
    next_cursor?: string;
};

/** the error body of the app api; branch on `code`, `message` is for people and can change */
export type AppErrorBody = {
    error: { code: AppErrorCode; message: string };
};

/** the codes that are not a game rule; a 422 can carry any game code (`market_price_changed`, `trade_level_too_low`, ...) */
export type AppErrorCode =
    | "invalid_request"
    | "approval_unavailable"
    | "invalid_redirect_uri"
    | "text_too_long"
    | "invalid_token"
    | "insufficient_scope"
    | "not_clan_officer"
    | "not_friends"
    | "not_found"
    | "busy"
    | "idempotency_in_progress"
    | "item_locked"
    | "rejected"
    | "rate_limited"
    | "dm_limit_reached"
    | "server_error"
    | "temporarily_unavailable"
    | (string & {});

/* ---------- players ---------- */

/** another player as an app sees them: the subject id is per app and stable, the name is public and can change */
export type AppPlayerRef = {
    sub: string;
    name: string;
};

/** GET /app/v1/players/by-name/:name, and `data` of GET /app/v1/me */
export type AppPlayer = {
    /** the player's subject id in this app, the key to store users under */
    sub: string;
    name: string;
    level: number;
    /** the clan tag, absent without a clan */
    clan?: string;
    premium: boolean;
    verified: boolean;
};

/** GET /app/v1/me, also the userinfo endpoint; `scopes` sits next to `data` */
export type AppMe = {
    data: AppPlayer;
    /** what this token can use right now */
    scopes: AppScope[];
};

/* ---------- items ---------- */

/** how worn a copy is, from `wear` */
export type AppWearTier = "Flawless" | "Tested" | "Trashed" | "Wrecked";

/** the kill counter of a copy, by stat */
export type AppKounter = {
    kills?: number;
    hskills?: number;
    aikills?: number;
    headshots?: number;
    hits?: number;
    shots?: number;
    jumps?: number;
};

/** one copy or one stack, as the inventory, trades and listings show it; names, images and rarities are in /data/skins by `skin_index` */
export type AppItem = {
    /** the copy's global id; a stackable item has none and is addressed by `skin_index` and `count` */
    instance_id?: number;
    /** the catalog item */
    skin_index: number;
    count: number;
    stackable: boolean;
    /** inventory only: the player locked this copy or stack in game, apps can't use it */
    locked?: boolean;
    /** 0 is best */
    wear?: number;
    wear_tier?: AppWearTier;
    /** the mint number */
    serial?: number;
    /** hex colour */
    paint?: string;
    /** the paint shader id, instead of `paint` */
    paint_shader?: number;
    style?: number;
    nametag?: string;
    /** 0 to 999999 */
    pattern_seed?: number;
    kounter?: AppKounter;
};

/** one balance of GET /app/v1/inventory/currencies; 1 is KR, 2 is Junk */
export type AppCurrency = {
    currency_id: number;
    name: string;
    symbol: string;
    amount: number;
};

/* ---------- stats ---------- */

/** one class of GET /app/v1/stats */
export type AppClassStats = {
    class_id: number;
    name: string;
    score: number;
    level: number;
};

/** one raid map of GET /app/v1/stats */
export type AppRaidStats = {
    map_id: number;
    completions: number;
    attempts: number;
    best_time_ms: number;
    ai_kills: number;
    boss_kills: number;
    deaths: number;
};

/** GET /app/v1/stats, lifetime stats without KR or any other currency */
export type AppStats = {
    level: number;
    score: number;
    kills: number;
    deaths: number;
    kdr: number;
    wins: number;
    losses: number;
    games: number;
    time_played_ms: number;
    /** hits / shots as a percentage */
    accuracy: number;
    combat: {
        assists: number;
        headshots: number;
        legshots: number;
        wallbangs: number;
        melee_kills: number;
        fist_kills: number;
        thrown_kills: number;
        shots: number;
        hits: number;
        nukes: number;
        airdrops: number;
        airdrops_stolen: number;
        slimers: number;
        juggernauts: number;
        juggernauts_killed: number;
        war_machines: number;
        crouches: number;
        sprays: number;
    };
    /** every class in game order */
    classes: AppClassStats[];
    raids: AppRaidStats[];
};

/** one region of GET /app/v1/stats/ranked */
export type AppRankedRegion = {
    region: number;
    region_name: string;
    /** "Unranked" during the 6 placement matches */
    rank: string;
    /** null during placement */
    mmr: number | null;
    /** present once the season tracks it */
    peak_mmr?: number;
    placement_matches_remaining: number;
    matches: number;
    wins: number;
    losses: number;
    kills: number;
    deaths: number;
    assists: number;
    score: number;
    damage_done: number;
    time_played_ms: number;
    best_kills_in_match: number;
    best_damage_in_match: number;
};

/** GET /app/v1/stats/ranked */
export type AppRankedStats = {
    season: number;
    current_season: number;
    season_ends_at: string;
    /** empty when the player hasn't played that season */
    regions: AppRankedRegion[];
};

/** the `type` filter of GET /app/v1/stats/challenges */
export type AppChallengeType = "map" | "weapon" | "nightmare" | "ranked" | "daily" | "weekly" | "event";

/** one row of GET /app/v1/stats/challenges */
export type AppChallenge = {
    challenge_id: number;
    name: string;
    type: AppChallengeType;
    icon: number;
    /** the game's own challenge definition, passed through */
    requirement: Record<string, unknown>;
    target: number;
    progress: number;
    completed: boolean;
    /** the game's own reward definition, passed through */
    rewards: Record<string, unknown>;
    /** absent for a challenge without an end date */
    ends_at?: string;
};

/* ---------- trades ---------- */

/** an amount of one currency in a trade */
export type AppTradeCurrency = {
    currency_id: number;
    amount: number;
};

/** one side of a trade */
export type AppTradeSide = {
    items: AppItem[];
    currencies: AppTradeCurrency[];
};

/** one row of GET /app/v1/trades */
export type AppTrade = {
    trade_id: number;
    status: "open" | "completed";
    /** sender when the player created the trade, recipient when it was sent to them */
    role: "sender" | "recipient";
    /** null when that account no longer exists */
    partner: AppPlayerRef | null;
    /** what the sender gives */
    offered: AppTradeSide;
    /** what the sender asks for */
    requested: AppTradeSide;
    message?: string;
    created_at: string;
    completed_at?: string;
};

/** GET /app/v1/trades/count */
export type AppTradeCount = {
    open: number;
    completed: number;
};

/* ---------- market ---------- */

/** one row of GET /app/v1/market/listings, an active listing of the player */
export type AppListing = {
    listing_id: number;
    /** KR */
    price: number;
    item: AppItem;
    listed_at: string;
};

/** one row of GET /app/v1/market/history; quick-sells are not in it */
export type AppMarketHistoryEntry = {
    listing_id: number;
    side: "sold" | "bought";
    status: "completed" | "cancelled";
    skin_index: number;
    /** KR */
    price: number;
    /** absent on a cancelled listing */
    counterparty?: AppPlayerRef;
    at: string;
};

/* ---------- friends, maps, clan ---------- */

/** one row of GET /app/v1/friends/following and /followers */
export type AppFriend = AppPlayerRef & {
    since: string;
    /** absent while presence is unavailable: unknown, not offline */
    online?: boolean;
};

/** one row of GET /app/v1/maps, a published map of the player */
export type AppMap = {
    map_id: number;
    name: string;
    /** absent when empty */
    description?: string;
    votes: number;
    plays: number;
    /** the total time players have spent in the map */
    playtime_ms: number;
    featured: boolean;
    verified: boolean;
    restricted: boolean;
    category: number;
    updates: number;
    created_at: string;
    updated_at: string;
};

/** a member's role, highest first */
export type AppClanRole = "owner" | "commander" | "captain" | "soldier" | "recruit";

/** the clan of GET /app/v1/clan; the KR bank is not included */
export type AppClan = {
    clan_id: number;
    name: string;
    score: number;
    rank: number;
    logo: number;
    banner_color: string;
    member_count: number;
};

/** GET /app/v1/clan; only `clan: null` when the player has no clan */
export type AppClanMembership = {
    clan: AppClan | null;
    role?: AppClanRole;
    /** the player can see join applications (the owner or a captain) */
    is_officer?: boolean;
};

/** one row of GET /app/v1/clan/members */
export type AppClanMember = AppPlayerRef & {
    role: AppClanRole;
    score: number;
};

/* ---------- notifications, dms ---------- */

/** who a mail is from; Krunker itself has no `sub`, a deleted account is `{name: "Unknown", system: false}` */
export type AppNotificationSender = {
    sub?: string;
    name: string;
    system: boolean;
};

/** one row of GET /app/v1/notifications, a Krunker Mail */
export type AppNotification = {
    notification_id: number;
    /** the in-game mail tab */
    category: "followers" | "clan" | "hub" | "inbox";
    subject: string;
    text: string;
    /** the game's own reference for the mail, often a player or clan name */
    link?: string;
    from: AppNotificationSender;
    read: boolean;
    sent_at: string;
    read_at?: string;
};

/** GET /app/v1/notifications/count */
export type AppNotificationCount = {
    unread: number;
};

/** one direct message */
export type AppDm = {
    message_id: number;
    from_me: boolean;
    text: string;
    sent_at: string;
    /** whether the recipient has read it */
    read: boolean;
    /** the name of the app it was sent through */
    via?: string;
};

/** one row of GET /app/v1/dms */
export type AppDmConversation = {
    peer: AppPlayerRef;
    /** messages from the peer the player hasn't read in game */
    unread: number;
    last_message: AppDm;
};

/** GET /app/v1/dms/:sub, newest first; `peer` sits next to `data` */
export type AppDmThread = {
    peer: AppPlayerRef;
    data: AppDm[];
    /** opaque, absent on the last page */
    next_cursor?: string;
};

/* ---------- per-action approval ---------- */

/** where a per-action approval stands */
export type AppActionStatus = "pending" | "approved" | "failed" | "denied" | "expired";

/** the 202 a write answers with when it was sent with `Krunker-Approval: request` */
export type AppActionRequest = {
    action_id: string;
    status: "pending";
    /** where to send the player */
    approve_url: string;
    expires_at: string;
};

/** GET /app/v1/actions/:action_id, kept for 24 hours */
export type AppAction = {
    action_id: string;
    /** e.g. `follow.remove` */
    type: string;
    status: AppActionStatus;
    /** what the player was shown */
    summary: Record<string, unknown>;
    created_at: string;
    expires_at: string;
    decided_at?: string;
    /** the http status of the call, once the action has run */
    result_status?: number;
    /** the body the direct call would have returned (approved) or its error body (failed) */
    result?: unknown;
};

/* ---------- webhooks ---------- */

/** the event types an app's webhook can receive, besides `webhook.test` and `webhook.verify` */
export type AppWebhookEventType = "trade.received" | "trade.completed" | "market.sold" | "dm.received" | "friend.followed" | "notification.received" | "grant.revoked";

/** the body of one delivery about a player, by event type */
export type AppWebhookOf<Type extends string, Data> = {
    /** unique per event in the app; retries and redeliveries repeat it */
    id: number;
    type: Type;
    created_at: string;
    /** the player the event is about */
    sub: string;
    data: Data;
};

/** a delivery to an app's webhook: a signal with ids, the details are read with the app api. verify it with verifyWebhook */
export type AppWebhookEvent =
    | AppWebhookOf<"trade.received", { trade_id: number; from: AppPlayerRef }>
    | AppWebhookOf<"trade.completed", { trade_id: number; partner: AppPlayerRef }>
    | AppWebhookOf<"market.sold", { listing_id: number; skin_index: number; price: number; buyer: AppPlayerRef }>
    | AppWebhookOf<"dm.received", { message_id: number; from: AppPlayerRef }>
    | AppWebhookOf<"friend.followed", { follower: AppPlayerRef }>
    | AppWebhookOf<"notification.received", { notification_id: number; system: boolean; from?: AppPlayerRef }>
    | AppWebhookOf<"grant.revoked", { reason: "player" | "staff" | "deleted" }>
    | { id: 0; type: "webhook.test"; created_at: string; data: { message: string } }
    | { id: 0; type: "webhook.verify"; created_at: string; data: Record<string, unknown> };

/* ---------- writes: shapes only, krapio sends none of them ---------- */

/** body of POST /app/v1/market/listings; `instance_id` picks the copy of a non-stackable item */
export type AppListBody = { skin_index: number; instance_id?: number; price: number };
/** reply of POST /app/v1/market/listings; `kr` is the balance after the fee */
export type AppListResult = { listing_id: number; skin_index: number; instance_id?: number; price: number; kr: number };

/** body of POST /app/v1/market/listings/bulk, 100 units at most */
export type AppBulkListBody = { items: (AppListBody & { count?: number })[] };
/** reply of POST /app/v1/market/listings/bulk; a failed entry has `listed: 0` with `error` and `code` */
export type AppBulkListResult = {
    listed: number;
    kr: number;
    results: { skin_index: number; instance_id?: number; listed: number; listing_ids?: number[]; error?: string; code?: string }[];
};

/** reply of DELETE /app/v1/market/listings/:listing_id */
export type AppUnlistResult = { listing_id: number; unlisted: boolean };

/** body of POST /app/v1/market/purchase; `max_price` is the price the player was shown */
export type AppPurchaseBody = { listing_id: number; max_price: number };
/** reply of POST /app/v1/market/purchase */
export type AppPurchaseResult = { listing_id: number; skin_index: number; instance_id?: number; price: number; kr: number };

/** body of POST /app/v1/market/buy-multiple, the cheapest `count` listings or nothing */
export type AppBuyMultipleBody = { skin_index: number; count: number; max_total: number };
/** reply of POST /app/v1/market/buy-multiple */
export type AppBuyMultipleResult = { skin_index: number; bought: number; spent: number; kr: number; instance_ids: number[] };

/** one entry of `give` or `receive`: pinned copies or a count */
export type AppTradeOffer = { skin_index: number; instance_ids?: number[]; count?: number };
/** body of POST /app/v1/trades; `to` is a subject id */
export type AppCreateTradeBody = { to: string; give: AppTradeOffer[]; receive: AppTradeOffer[]; message?: string };
/** reply of POST /app/v1/trades */
export type AppCreateTradeResult = { trade_id: number; to: AppPlayerRef; kr: number };
/** reply of POST /app/v1/trades/:trade_id/accept */
export type AppAcceptTradeResult = { trade_id: number; accepted: boolean; kr: number };
/** reply of POST /app/v1/trades/:trade_id/cancel */
export type AppCancelTradeResult = { trade_id: number; cancelled: boolean };
/** reply of POST /app/v1/trades/decline-all */
export type AppDeclineAllResult = { declined: boolean };

/** body of POST /app/v1/inventory/quick-sell */
export type AppQuickSellBody = { skin_index: number; instance_id?: number; action: "kr" | "junk" | "destroy"; amount?: "one" | "all_but_one" | "all" };
/** reply of POST /app/v1/inventory/quick-sell; `remaining` is how many copies are left */
export type AppQuickSellResult = { skin_index: number; remaining: number; kr: number; junk: number };
/** body of POST /app/v1/inventory/quick-sell/bulk, 250 non-stackable copies at most */
export type AppBulkQuickSellBody = { action: "kr" | "junk" | "destroy"; items: { instance_id: number; skin_index: number }[] };
/** reply of POST /app/v1/inventory/quick-sell/bulk */
export type AppBulkQuickSellResult = {
    sold: number[];
    skipped: { instance_id: number; reason: "not_owned" | "no_value" | "unavailable" }[];
    kr: number;
    junk: number;
};

/** body of POST /app/v1/inventory/items/:instance_id/paint */
export type AppPaintBody = { skin_index: number; paint_skin_index: number };
/** reply of POST /app/v1/inventory/items/:instance_id/paint; a shader paint answers with `paint_shader` */
export type AppPaintResult = { instance_id: number; paint?: string; paint_shader?: number; paint_remaining: number };
/** body of POST /app/v1/inventory/items/:instance_id/style */
export type AppStyleBody = { skin_index: number; style: number };
/** reply of POST /app/v1/inventory/items/:instance_id/style */
export type AppStyleResult = { instance_id: number; style: number };
/** body of POST /app/v1/inventory/locks: a copy, or a whole stack by `skin_index` */
export type AppLockBody = { instance_id: number } | { skin_index: number };
/** reply of POST /app/v1/inventory/locks */
export type AppLockResult = { skin_index: number; instance_id?: number; locked: boolean };

/** body of POST /app/v1/inventory/gift; 10 KR at least, the sender pays 10% on top */
export type AppGiftBody = { to: string; amount: number; message?: string };
/** reply of POST /app/v1/inventory/gift */
export type AppGiftResult = { to: AppPlayerRef; amount: number; kr: number };

/** reply of PUT and DELETE /app/v1/friends/following/:sub */
export type AppFollowResult = AppPlayerRef & { following: boolean };

/** body of POST /app/v1/dms/:sub, 1 to 512 bytes of utf-8 */
export type AppSendDmBody = { text: string };
