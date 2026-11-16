import type { AppReply } from "./types.js";

// ========================= //
// = Copyright (c) NullDev = //
// =     - SPDX: MIT -     = //
// ========================= //

/** paging of the app api's lists */
export type AppPageQuery = {
    /** the `next_cursor` of the previous page */
    cursor?: string;
    /** 1 to 100, 50 when omitted (dms: 1 to 50, 20 when omitted) */
    limit?: number;
};

/** `{data}` of a single object, unwrapped; errors of the app api come as a 4xx or 5xx, never inside a 200 */
export const unwrapApp = async <T>(reply: Promise<AppReply<T>>): Promise<T> => (await reply).data;
