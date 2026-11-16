// ========================= //
// = Copyright (c) NullDev = //
// =     - SPDX: MIT -     = //
// ========================= //

/** the base of every error krapio throws */
export class KrunkerError extends Error {
    constructor(message: string, options?: ErrorOptions){
        super(message, options);
        this.name = new.target.name;
    }
}

/** a call was made with an argument the api would reject, nothing was sent */
export class KrunkerArgumentError extends KrunkerError {}

/** no api key configured */
export class KrunkerConfigError extends KrunkerError {}

/** a player token that is malformed or already expired, or an empty app access token; nothing was sent */
export class KrunkerTokenError extends KrunkerError {}

/** the request never got an http reply */
export class KrunkerNetworkError extends KrunkerError {
    readonly timeout: boolean;

    constructor(message: string, timeout: boolean, cause?: unknown){
        super(message, { cause });
        this.timeout = timeout;
    }
}

/** a reply with a non 2xx status; the subclasses cover the common ones */
export class KrunkerHttpError extends KrunkerError {
    readonly status: number;
    readonly url: string;
    /** parsed error body, or the raw text when it was no json */
    readonly body: unknown;

    constructor(status: number, url: string, body: unknown, message?: string){
        super(message ?? `Krunker API ${status} for ${url}`);
        this.status = status;
        this.url = url;
        this.body = body;
    }

    /**
     * the machine readable code of the reply, null when it has none: `error.code` of gapi and the app api
     * (`insufficient_scope`, `not_clan_officer`, ...) or the `error` of an oauth endpoint (`invalid_grant`, ...)
     */
    get code(): string | null {
        const error = (this.body as { error?: unknown } | null)?.error;
        if (typeof error === "object" && error !== null && typeof (error as { code?: unknown }).code === "string") return (error as { code: string }).code;
        // the developer api puts a sentence there, the oauth endpoints a code
        return typeof error === "string" && /^[a-z_]+$/.test(error) ? error : null;
    }
}

/** 400, the api rejected a parameter the local checks did not catch */
export class KrunkerBadRequestError extends KrunkerHttpError {}

/** a token or app endpoint without a valid token: missing, expired or rejected; on the oauth endpoints a failed client authentication */
export class KrunkerUnauthorizedError extends KrunkerHttpError {}

/** the api key is invalid or revoked; on a token endpoint the player lacks the role (moderator, kpd reviewer); on the app api the token lacks the scope */
export class KrunkerForbiddenError extends KrunkerHttpError {}

/** 404, no such player, clan, map, mod or match */
export class KrunkerNotFoundError extends KrunkerHttpError {}

/** 429, or a request refused locally because the window is known to be empty */
export class KrunkerRateLimitError extends KrunkerHttpError {
    /** seconds until the window resets */
    readonly retryAfter: number;
    /** true when the client refused to send because the window is known to be empty */
    readonly preemptive: boolean;

    constructor(url: string, retryAfter: number, body: unknown, preemptive = false){
        super(429, url, body, `Krunker API rate limit hit for ${url}, retry in ${retryAfter}s`);
        this.retryAfter = retryAfter;
        this.preemptive = preemptive;
    }
}

/** a 5xx; retried once before it is thrown */
export class KrunkerServerError extends KrunkerHttpError {}

/** type guard for KrunkerNotFoundError */
export const isNotFound = (err: unknown): err is KrunkerNotFoundError => err instanceof KrunkerNotFoundError;
/** type guard for KrunkerRateLimitError */
export const isRateLimited = (err: unknown): err is KrunkerRateLimitError => err instanceof KrunkerRateLimitError;

/** retrying makes sense for these, the request itself was fine */
export const isTransient = (err: unknown): boolean =>
    err instanceof KrunkerNetworkError || err instanceof KrunkerServerError || err instanceof KrunkerRateLimitError;
