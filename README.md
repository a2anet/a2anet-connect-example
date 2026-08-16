# a2anet-connect-example

The `/agent/connect` endpoint and page that link a Slack, Teams or Copilot user to
one of your own customers.

An agent published to a chat platform runs as **your customer**, never as you and
never as an anonymous Slack account. A2A Net does not know who your customers are,
so linking happens once, on your own site, against your own sign-in.

## The flow

1. An unlinked user messages the agent — or runs its command, clicks one of its
   buttons, or reacts to point it at something. A2A Net posts a **Connect** button
   and **no run happens**: no conversation, no credits
2. The button opens your Customer Sign-In URL with a ten-minute, single-use token
   as `?token=`. The token names the platform user and the agent, and nothing else
3. Your page signs the visitor in the way your product already does
4. Your backend `POST`s the token and your own identifier for that user to
   `POST /api/v1/customer-links`, with your A2A Net API key
5. A2A Net stores the link. It is durable — only the token was short-lived — and
   the user's next message runs as that customer

A2A Net never sees the customer's credentials.

## Files

| File                   | What it is                                                       |
| ---------------------- | ---------------------------------------------------------------- |
| `src/connect.ts`       | `POST /agent/connect`. Redeems the token against A2A Net          |
| `src/connect-page.tsx` | The page the Connect button opens. Five states, no styling        |

## Environment

Server side only — an `A2ANET_API_KEY` that reaches the browser is a leaked
credential:

| Variable         | What it is                                                          |
| ---------------- | ------------------------------------------------------------------- |
| `A2ANET_API_KEY` | A standard user API key, minted at <https://app.a2anet.com/api-keys> |
| `A2ANET_API_URL` | `https://app.a2anet.com/api/v1`                                      |

## Your Customer Sign-In URL

Set it on the agent's Publish page, under **Customer Sign-In**. Serving the page
below at `/agent/connect` makes it:

```
https://your-domain.com/agent/connect
```

Until it is set, the agent has no page to send anyone to, so it can link nobody
and answers nobody.

## What can go wrong

The three answers a person can get, and what each means:

| Status              | What happened                          | What to tell them            |
| ------------------- | -------------------------------------- | ---------------------------- |
| `400 INVALID_LINK`  | Expired, tampered with, or not a token | Ask the agent for a new link |
| `409`               | The link was already redeemed          | Ask for a new one if needed  |
| `502`               | A2A Net could not be reached           | Try again                    |

## Running the checks

```bash
make install
make ci
```

This is source to copy, not an app to boot — you already have a server, a router
and a sign-in flow. Take the two files and see `AGENTS.md`.
