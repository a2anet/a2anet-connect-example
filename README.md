# A2A Net Connect Example

This is an example implementation of the `/agent/connect` endpoint, which allows
you to authenticate Slack, Teams, and Copilot users with your product.

Without a Customer Sign-In URL an agent runs as its owner. This endpoint is what
makes it run as each of your customers instead.

## The flow

1. An unlinked user messages the agent — or runs its command, clicks one of its
   buttons, or reacts to point it at something. A2A Net posts a **Connect** button
2. The button opens your Customer Sign-In URL with a ten-minute, single-use token
   as `?token=`, and the app they came from as `?platform=`
3. Your page signs the visitor in the way your product already does
4. Your backend `POST`s the token and your own identifier for that user to
   `POST /api/v1/customer-links`, with your A2A Net API key
5. A2A Net stores the link. It is durable — only the token was short-lived — and
   the user's next message runs as that customer

A2A Net never sees the customer's credentials.

## Files

| File                   | What it is                                                |
| ---------------------- | --------------------------------------------------------- |
| `src/connect.ts`       | `POST /agent/connect`. Redeems the token against A2A Net  |
| `src/connect-page.tsx` | The page the Connect button opens. Five states, no styling |

## Environment

Server side only — an `A2ANET_API_KEY` that reaches the browser is a leaked
credential:

| Variable         | What it is                                                          |
| ---------------- | ------------------------------------------------------------------- |
| `A2ANET_API_KEY` | A standard user API key, minted at <https://app.a2anet.com/api-keys> |
| `A2ANET_API_URL` | `https://app.a2anet.com/api/v1`                                      |

## Your Customer Sign-In URL

Set it on the agent's Publish page, in the last step of Slack or Teams setup.
Serving the page below at `/agent/connect` makes it:

```
https://app.example.com/agent/connect
```

## What can go wrong

| Status                | What happened                          | What to tell them            |
| --------------------- | -------------------------------------- | ---------------------------- |
| `400 invalid_request` | Expired, tampered with, or not a token | Ask the agent for a new link |
| `409 link_token_used` | The link was already redeemed          | Ask for a new one if needed  |
| `502`                 | A2A Net could not be reached           | Try again                    |

## Running the checks

```bash
bun install
bun run check && bun run typecheck && bun test
```

This is source to copy, not an app to boot — you already have a server, a router
and a sign-in flow. Take the two files and see `AGENTS.md`.
