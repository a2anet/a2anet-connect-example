// SPDX-FileCopyrightText: 2026-present A2A Net <hello@a2anet.com>
//
// SPDX-License-Identifier: Apache-2.0

/**
 * The page the Connect button opens.
 *
 * It reads `?token=`, makes sure the visitor is signed in to your product, and
 * posts the token to your own `/agent/connect`. Everything it renders is one of
 * five states, because those are the only five things that can happen and each
 * one needs a person to be told something different.
 *
 * Unstyled by design: drop it into your own layout and give it your own
 * components. What matters is the states and the order they happen in.
 */

import { useEffect, useRef, useState } from "react";

/**
 * Where the visitor is.
 *
 * `ready` is the only state with a button. The other four are terminal, and the
 * three that are not `failed` all end the same way: go back to the chat app.
 */
export type ConnectStatus = "ready" | "connected" | "invalid" | "used" | "failed";

interface StatusContent {
    title: string;
    detail: string;
}

/**
 * What to say in each terminal state.
 * @param status Where the visitor ended up.
 * @param platform The chat app they came from.
 * @returns The heading and explanation, or undefined while there is still a button.
 */
export function statusContent(status: ConnectStatus, platform: string): StatusContent | undefined {
    if (status === "connected") {
        return {
            title: "Account connected",
            detail: `Return to ${platform} and send a message to the agent`,
        };
    }
    if (status === "invalid") {
        return {
            title: "This link has expired",
            detail: `Return to ${platform} and ask the agent for a new link`,
        };
    }
    if (status === "used") {
        return {
            title: "This link has already been used",
            detail: `Return to ${platform} and ask the agent for a new link if you still need one`,
        };
    }
    return undefined;
}

export interface ConnectPageProps {
    /** The `?token=` query parameter, however your router hands it over. */
    token: string;
    /** The `?platform=` query parameter: "slack", "teams" or "copilot". */
    platform: string;
    /** Whether your own session is loading. */
    loading: boolean;
    /** Whether the visitor is signed in to your product. */
    isAuthenticated: boolean;
    /** Starts your sign-in flow, returning the visitor to this URL afterwards. */
    signIn: (returnTo: string) => Promise<void>;
}

/** Links the signed-in visitor's account to the chat identity that sent them here. */
export function ConnectPage({
    token,
    platform,
    loading,
    isAuthenticated,
    signIn,
}: ConnectPageProps) {
    const [status, setStatus] = useState<ConnectStatus>("ready");
    const [submitting, setSubmitting] = useState(false);
    const signInStarted = useRef(false);
    // A2A Net sends the app the visitor came from, so nothing here has to decode a
    // token to print a noun. An old link that predates it names all three.
    const app = platform
        ? platform[0].toUpperCase() + platform.slice(1)
        : "Slack, Teams, or Copilot";

    // A link carries a token, so the page must not be indexed and must not leak
    // it to whatever the visitor clicks next.
    useEffect(() => {
        const robots = document.createElement("meta");
        robots.name = "robots";
        robots.content = "noindex,nofollow";
        const referrer = document.createElement("meta");
        referrer.name = "referrer";
        referrer.content = "no-referrer";
        document.head.append(robots, referrer);
        return () => {
            robots.remove();
            referrer.remove();
        };
    }, []);

    // Sign-in happens on arrival rather than behind the button: the visitor came
    // here to connect, and being asked to click twice explains nothing.
    useEffect(() => {
        if (status !== "ready" || !token || loading || isAuthenticated) return;
        if (signInStarted.current) return;
        signInStarted.current = true;
        signIn(`/agent/connect?${new URLSearchParams({ token, platform }).toString()}`).catch(() =>
            setStatus("failed"),
        );
    }, [isAuthenticated, loading, platform, signIn, status, token]);

    const connect = async (): Promise<void> => {
        if (submitting) return;
        setSubmitting(true);
        try {
            const response = await fetch("/agent/connect", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token }),
            });
            if (response.ok) setStatus("connected");
            else if (response.status === 400) setStatus("invalid");
            else if (response.status === 409) setStatus("used");
            else setStatus("failed");
        } catch {
            setStatus("failed");
        } finally {
            setSubmitting(false);
        }
    };

    const content = statusContent(status, app);
    if (content) {
        return (
            <main>
                <h1>{content.title}</h1>
                <p>{content.detail}</p>
            </main>
        );
    }

    // No token at all is the same thing to a person as an expired one: the link
    // they clicked does not work any more.
    if (!token) {
        return (
            <main>
                <h1>This link has expired</h1>
                <p>Return to {app} and ask the agent for a new link</p>
            </main>
        );
    }

    if (loading || !isAuthenticated) {
        return (
            <main>
                <h1>Connect your account</h1>
                {status === "failed" ? (
                    <p>We could not sign you in. Please try again.</p>
                ) : (
                    <p>Signing you in…</p>
                )}
            </main>
        );
    }

    return (
        <main>
            <h1>Connect your account</h1>
            <p>Connect your account to {app}</p>
            {status === "failed" && <p>We could not connect the account. Please try again.</p>}
            <button type="button" onClick={() => void connect()} disabled={submitting}>
                {submitting ? "Connecting…" : "Connect"}
            </button>
        </main>
    );
}
