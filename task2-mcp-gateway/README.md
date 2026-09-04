# Task 2 - MCP Security Gateway Proxy

This is an HTTP JSON-RPC proxy that sits between a client and a mock downstream MCP server.

The gateway reads the bearer token, maps it to a role, checks the requested tool, and decides whether to forward the request or block it.

## Run it

```bash
npm install
npm run build
npm test
```

To run it manually, use two terminals:

```bash
npm run start:downstream
npm run start:gateway
```

The downstream mock runs on `http://localhost:4000`. The gateway runs on `http://localhost:4001`.

Example blocked call:

```powershell
Invoke-RestMethod -Uri http://localhost:4001 -Method Post -ContentType "application/json" `
  -Headers @{ Authorization = "Bearer viewer-token-456" } `
  -Body '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"admin_reset_key"}}'
```

## What is implemented

`src/auth.ts` handles token-to-role lookup. For the assessment I kept this as a small static map:

- `admin-token-123` -> `admin`
- `viewer-token-456` -> `viewer`

In a real system this would usually be JWT verification or a call to an identity provider, but the gateway logic would stay the same.

`src/downstream-mock.ts` is the fake MCP server. It supports `tools/list` and `tools/call`, including an admin tool called `admin_reset_key`.

`src/gateway.ts` contains the proxy logic:

- `tools/list` is forwarded for any valid token
- `tools/call` is inspected before forwarding
- if the tool name starts with `admin_`, the caller must have the `admin` role
- otherwise the gateway returns JSON-RPC error `-32001` with `Unauthorized Tool Call`

The important part is that unauthorized admin calls are blocked at the gateway and are not sent to the downstream server.

## Test coverage

`test/gateway.test.ts` starts both servers on test ports and verifies:

- `tools/list` is forwarded
- viewer can call a normal tool
- viewer cannot call `admin_reset_key`
- admin can call `admin_reset_key`
- missing auth is rejected
