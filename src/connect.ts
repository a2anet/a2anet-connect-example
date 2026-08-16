// SPDX-FileCopyrightText: 2026-present A2A Net <hello@a2anet.com>
//
// SPDX-License-Identifier: Apache-2.0

/**
 * `POST /agent/connect` — the endpoint that turns a Slack or Teams user into one
 * of your customers.
 *
 * The link token arrives in the browser, from the Connect button A2A Net posted
 * to an unlinked user. It names that platform user and nothing else; who they are
 * in *your* product is a question only you can answer, which is why this exchange
 * happens on your server, against your session, with your API key.
 *
 * Framework-free on purpose. `redeemLinkToken` is the part that matters and drops
 * into anything; `handleConnectRequest` wraps it for any runtime that speaks the
 * web `Request`/`Response` types (Next.js route handlers, Hono, Bun.serve).
 */

/** What went wrong, in the terms the page has to explain to a person. */
export type ConnectFailure = "invalid" | "used" | "unreachable";

export type ConnectResult = { connected: true } | { connected: false; reason: ConnectFailure };

/**
 * Per-customer values the agent's tools resolve at run time.
 *
 * Variables reach the agent's session; secrets never do. Use them to hand the
 * agent this customer's own access to your API, so a run in Slack acts as them
 * rather than as you.
 */
export interface RequestValues {
    variables?: Record<string, string>;
    secrets?: Record<string, string>;
}

const env = (name: string): string => {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is not set`);
    return value;
};

/**
 * Redeems a link token against A2A Net, binding it to one of your customers.
 * @param linkToken The `?token=` the Connect button carried into the browser.
 * @param customerId Your own identifier for the signed-in user.
 * @param values Per-customer variables and secrets for this customer's runs.
 * @returns Whether the link was made, and why not when it was not.
 */
export async function redeemLinkToken(
    linkToken: string,
    customerId: string,
    values: RequestValues = {},
): Promise<ConnectResult> {
    let response: Response;
    try {
        response = await fetch(`${env("A2ANET_API_URL")}/customer-links`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${env("A2ANET_API_KEY")}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ linkToken, customerId, ...values }),
        });
    } catch {
        return { connected: false, reason: "unreachable" };
    }

    if (response.ok) return { connected: true };
    // A token that is expired, tampered with, or simply wrong is one case to the
    // person holding it: ask the agent for a new link.
    if (response.status === 400) return { connected: false, reason: "invalid" };
    // A second click on the same button. The link is single-use by design.
    if (response.status === 409) return { connected: false, reason: "used" };
    return { connected: false, reason: "unreachable" };
}

/** Resolves the signed-in user, or null when the request carries no session. */
export type Authenticate = (request: Request) => Promise<string | null>;

const STATUS_BY_REASON: Record<ConnectFailure, number> = {
    invalid: 400,
    used: 409,
    unreachable: 502,
};

const MESSAGE_BY_REASON: Record<ConnectFailure, string> = {
    invalid: "This connection link is invalid or has expired",
    used: "This connection link has already been used",
    unreachable: "A2A Net could not be reached",
};

const json = (body: unknown, status: number): Response =>
    new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });

/**
 * Builds the route handler.
 * @param authenticate Your own session check, returning the customer id.
 * @returns A handler to mount at `POST /agent/connect`.
 */
export function handleConnectRequest(
    authenticate: Authenticate,
): (request: Request) => Promise<Response> {
    return async (request: Request): Promise<Response> => {
        const customerId = await authenticate(request);
        if (!customerId) return json({ error: "Unauthorized" }, 401);

        const body = (await request.json().catch(() => ({}))) as { token?: string };
        const linkToken = body.token?.trim();
        if (!linkToken) return json({ error: "A connection token is required" }, 400);

        // Whatever this customer's runs need, if the agent's tools take any:
        //   { variables: { yourServerUrl: API_BASE }, secrets: { yourToken: ... } }
        const result = await redeemLinkToken(linkToken, customerId);
        if (result.connected) return json({ connected: true }, 200);

        return json({ error: MESSAGE_BY_REASON[result.reason] }, STATUS_BY_REASON[result.reason]);
    };
}
