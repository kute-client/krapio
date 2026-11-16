import type { KrunkerClient } from "../../client.js";
import * as check from "../../validate.js";
import { unwrapApp } from "../envelope.js";
import type { AppPageQuery } from "../envelope.js";
import type { AppChallenge, AppChallengeType, AppPage, AppRankedStats, AppReply, AppStats } from "../types.js";

// ========================= //
// = Copyright (c) NullDev = //
// =     - SPDX: MIT -     = //
// ========================= //

const MAX_LIMIT = 100;

const CHALLENGE_TYPES = ["map", "weapon", "nightmare", "ranked", "daily", "weekly", "event"] as const;
const CHALLENGE_STATUS = ["all", "completed", "in_progress"] as const;

/** filters of GET /app/v1/stats/challenges */
export type AppChallengesQuery = AppPageQuery & {
    type?: AppChallengeType;
    /** all when omitted */
    status?: "all" | "completed" | "in_progress";
};

/** lifetime stats, the ranked profile and challenge progress; scope `stats:read` */
export class AppStatsApi {
    readonly #gapi: KrunkerClient;
    readonly #auth: Record<string, string>;

    constructor(gapi: KrunkerClient, auth: Record<string, string>){
        this.#gapi = gapi;
        this.#auth = auth;
    }

    /** GET /app/v1/stats (stats:read), lifetime stats; KR and other currencies are not in it */
    get(): Promise<AppStats> {
        return unwrapApp(this.#gapi.get<AppReply<AppStats>>("/app/v1/stats", { route: "app.stats.get", headers: this.#auth }));
    }

    /** GET /app/v1/stats/ranked (stats:read), the ranked profile per region; the current season when omitted */
    ranked(season?: number): Promise<AppRankedStats> {
        return unwrapApp(this.#gapi.get<AppReply<AppRankedStats>>("/app/v1/stats/ranked", {
            route: "app.stats.ranked",
            headers: this.#auth,
            query: { season: check.optionalInt(season, "season", 1) },
        }));
    }

    /** GET /app/v1/stats/challenges (stats:read), active challenges with the player's progress */
    challenges(query: AppChallengesQuery = {}): Promise<AppPage<AppChallenge>> {
        return this.#gapi.get<AppPage<AppChallenge>>("/app/v1/stats/challenges", {
            route: "app.stats.challenges",
            headers: this.#auth,
            query: {
                type: check.oneOf(query.type, CHALLENGE_TYPES, "type"),
                status: check.oneOf(query.status, CHALLENGE_STATUS, "status"),
                cursor: query.cursor,
                limit: check.optionalInt(query.limit, "limit", 1, MAX_LIMIT),
            },
        });
    }
}
