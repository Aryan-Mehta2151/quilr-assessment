# Task 4 - Rate-Limiting and Model Fallback Router

This task implements the routing layer of an LLM gateway.

Before calling a model provider, it checks whether the tenant has enough token budget left in the current sliding window. If the request is allowed, it calls the primary provider first. If the primary provider returns `429` or times out, the router tries the secondary provider.

## Run it

```bash
npm install
npm run build
npm test
```

To run the mock providers manually:

```bash
npm run start:primary
npm run start:secondary
```

The primary mock provider runs on `http://localhost:6000`. The secondary mock provider runs on `http://localhost:6001`.

## What is implemented

`src/db.ts` sets up the on-disk SQLite database and creates a `token_usage` table.

`src/rate-limiter.ts` implements a per-tenant sliding window rate limiter. Each request records:

- tenant key
- token count
- timestamp

On each check, old rows outside the window are removed, the remaining tokens are summed, and the request is allowed only if it stays within the limit. The default limit is 50,000 tokens per minute.

I used a sliding window instead of a fixed minute bucket because fixed windows allow bursts around the boundary between two minutes. Sliding windows are a better fit for a gateway that needs smoother enforcement.

`src/router.ts` handles the provider selection:

- reject immediately if the tenant is over the token limit
- call the primary provider first
- if primary returns `429`, try the secondary provider
- if primary times out after 3000ms, try the secondary provider
- return generic gateway errors instead of leaking raw upstream error text

The timeout uses `AbortController`, so the HTTP request is actually cancelled instead of just ignored locally.

`src/provider-mock.ts` is a test provider that can simulate success, `429`, timeout, or an internal error.

## Test coverage

`test/rate-limiter.test.ts` checks normal usage, over-limit rejection, tenant isolation, and stale usage eviction.

`test/router.test.ts` starts real mock providers and verifies:

- primary success
- fallback on primary `429`
- fallback on primary timeout
- sanitized errors for hard upstream failures
- secondary unavailable case
- rate-limit rejection before provider calls
