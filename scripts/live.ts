// a dozen reads against the real api, one per tier and host; KRUNKER_API_KEY for the developer tier,
// KRUNKER_TOKEN (a player's frvr jwt) for the token tier, KRUNKER_APP_TOKEN (an access token of Login with Krunker,
// kat_...) for the app tier, all optional. bun scripts/live.ts
import { Krunker, KrunkerError, KrunkerHttpError, RAID_MAPS } from "../src/index.js";

const krunker = new Krunker({
    apiKey: process.env.KRUNKER_API_KEY,
    userAgent: "krapio-live/0.1 (+https://github.com/NullDev/krapio)",
    logger: { debug: (m): void => console.log("   ", m), warn: (m): void => console.warn("   ", m) },
});

let pass = 0;
let fail = 0;

async function step(label: string, run: () => Promise<string>): Promise<void> {
    try {
        const note = await run();
        pass++;
        console.log(`OK   ${label}: ${note}`);
    }
    catch (err){
        fail++;
        let detail = err instanceof KrunkerError ? err.message : String(err);
        if (err instanceof KrunkerHttpError) detail = `${err.status} ${JSON.stringify(err.body)}`;
        console.log(`FAIL ${label}: ${(err as Error).name} ${detail}`);
    }
}

if (krunker.configured){
    await step("player.profile", async() => {
        const p = await krunker.player.profile("NulPing");
        return `${p.player_name} level ${p.level}`;
    });
    await step("skins.get", async() => `${(await krunker.skins.get(1)).name}`);
    await step("map.featured", async() => `${(await krunker.map.featured()).count} maps`);
    await step("leaderboard.ranked", async() => `${(await krunker.leaderboard.ranked(3)).entries.length} entries`);
    console.log("    key window:", JSON.stringify(krunker.rateLimit().global));
}
else console.log("skip developer tier, KRUNKER_API_KEY not set");

await step("game.market.stats", async() => `${(await krunker.game.market.stats({ limit: 5 })).stats.length} rows`);
await step("game.leaderboards.raidsMonthly", async() => {
    const month = new Date().toISOString().slice(0, 7);
    return `${(await krunker.game.leaderboards.raidsMonthly(RAID_MAPS[0]!, month)).length} rows for ${month}`;
});
await step("game.turf.status", async() => `${(await krunker.game.turf.status()).length} maps`);
await step("game.matchmaker.pingList", async() => `${Object.keys(await krunker.game.matchmaker.pingList()).length} regions`);
await step("game.legacy.itemPrices", async() => `${Object.keys(await krunker.game.legacy.itemPrices()).length} items`);

await step("oauth.discovery", async() => `${(await krunker.oauth.discovery()).scopes_supported.length} scopes`);

const token = process.env.KRUNKER_TOKEN;
if (token){
    const me = krunker.as(token);
    await step("as(token).player.wallet", async() => `${(await me.player.wallet()).currencies.length} currencies for ${me.claims.sub.slice(0, 8)}...`);
    await step("as(token).ranked.dailySpin", async() => `claimed ${(await me.ranked.dailySpin()).claimed}`);
}
else console.log("skip token tier, KRUNKER_TOKEN not set");

const appToken = process.env.KRUNKER_APP_TOKEN;
if (appToken){
    const app = krunker.app(appToken);
    await step("app(accessToken).player.me", async() => {
        const me = await app.player.me();
        return `level ${me.data.level} with ${me.scopes.join(" ")}`;
    });
}
else console.log("skip app tier, KRUNKER_APP_TOKEN not set");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
