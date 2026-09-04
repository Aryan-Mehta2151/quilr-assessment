# Task 1 - MCP Server

This is a small MCP server that runs over stdio and exposes two tools:

- `get_customer_record`
- `trigger_refund`

The main thing I focused on here was keeping the MCP transport clean. With stdio-based MCP servers, stdout is the protocol channel, so any normal debug logging there can break the client. For that reason, the server only writes JSON-RPC messages to stdout and sends logs to stderr through `src/logger.ts`.

## Run it

```bash
npm install
npm run build
npm test
```

To run the server directly:

```bash
npm run dev
```

## What is implemented

`src/index.ts` creates the MCP server, registers the tools, and connects it to `StdioServerTransport` from the official MCP SDK.

`src/schemas.ts` contains the validation rules. I used Zod for runtime validation, and matching JSON Schema objects for `tools/list` so an MCP client can see the expected input shape.

The validation rules are:

- `customer_id` must look like `CUST-12345`
- `amount` must be a positive number
- `reason` must be at least 10 characters

Invalid tool input returns a standard MCP/JSON-RPC invalid-params error (`-32602`). Unknown tools return method-not-found (`-32601`).

## Test coverage

`test/stdio.test.ts` starts the compiled server as a child process, sends real JSON-RPC messages through stdin, and checks that:

- stdout contains parseable JSON-RPC only
- bad input is rejected with `-32602`
- a valid refund call succeeds
