// SPDX-FileCopyrightText: 2026-present A2A Net <hello@a2anet.com>
//
// SPDX-License-Identifier: Apache-2.0

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { handleConnectRequest, redeemLinkToken } from "../src/connect.js";

const originalFetch = globalThis.fetch;

const respondWith = (status: number): void => {
    globalThis.fetch = (async () => new Response(null, { status })) as unknown as typeof fetch;
};

const post = (body: unknown): Request =>
    new Request("https://example.com/agent/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

beforeEach(() => {
    process.env.A2ANET_API_URL = "https://app.a2anet.com/api/v1";
    process.env.A2ANET_API_KEY = "a2anet_test";
});

afterEach(() => {
    globalThis.fetch = originalFetch;
});

describe("redeemLinkToken", () => {
    test("connects on success", async () => {
        respondWith(200);
        expect(await redeemLinkToken("token", "customer-1")).toEqual({ connected: true });
    });

    test("reports an expired or tampered token", async () => {
        respondWith(400);
        expect(await redeemLinkToken("token", "customer-1")).toEqual({
            connected: false,
            reason: "invalid",
        });
    });

    test("reports a link that has already been used", async () => {
        respondWith(409);
        expect(await redeemLinkToken("token", "customer-1")).toEqual({
            connected: false,
            reason: "used",
        });
    });

    test("reports A2A Net being unreachable", async () => {
        globalThis.fetch = (async () => {
            throw new Error("network");
        }) as unknown as typeof fetch;
        expect(await redeemLinkToken("token", "customer-1")).toEqual({
            connected: false,
            reason: "unreachable",
        });
    });

    test("sends the customer's own values", async () => {
        let sent: string | undefined;
        globalThis.fetch = (async (_url: string, init: RequestInit) => {
            sent = init.body as string;
            return new Response(null, { status: 200 });
        }) as unknown as typeof fetch;

        await redeemLinkToken("token", "customer-1", { secrets: { yourToken: "s3cret" } });

        expect(JSON.parse(sent ?? "{}")).toEqual({
            linkToken: "token",
            customerId: "customer-1",
            secrets: { yourToken: "s3cret" },
        });
    });
});

describe("handleConnectRequest", () => {
    const authenticated = async (): Promise<string> => "customer-1";

    test("refuses an unauthenticated caller before reaching A2A Net", async () => {
        respondWith(200);
        const handler = handleConnectRequest(async () => null);
        expect((await handler(post({ token: "token" }))).status).toBe(401);
    });

    test("refuses a request with no token", async () => {
        respondWith(200);
        const handler = handleConnectRequest(authenticated);
        expect((await handler(post({}))).status).toBe(400);
    });

    test("answers 200 once the link is made", async () => {
        respondWith(200);
        const handler = handleConnectRequest(authenticated);
        const response = await handler(post({ token: "token" }));
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ connected: true });
    });

    test("passes A2A Net's refusal through as its own status", async () => {
        respondWith(409);
        const handler = handleConnectRequest(authenticated);
        expect((await handler(post({ token: "token" }))).status).toBe(409);
    });
});
