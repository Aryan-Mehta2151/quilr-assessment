import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { resolveRoleFromHeader } from "./auth.js";

function downstreamUrl() {
  return process.env.DOWNSTREAM_URL ?? "http://localhost:4000";
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function forwardToDownstream(rpc: unknown): Promise<{ status: number; body: unknown }> {
  const upstreamRes = await fetch(downstreamUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rpc),
  });
  const body = await upstreamRes.json();
  return { status: upstreamRes.status, body };
}

const server = createServer(async (req, res) => {
  if (req.method !== "POST") {
    sendJson(res, 405, { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Only POST is supported" } });
    return;
  }

  const raw = await readBody(req);
  let rpc: any;
  try {
    rpc = JSON.parse(raw);
  } catch {
    sendJson(res, 400, { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
    return;
  }

  const { id = null, method, params } = rpc ?? {};
  if (typeof method !== "string") {
    sendJson(res, 400, { jsonrpc: "2.0", id, error: { code: -32600, message: "Invalid Request: 'method' is required" } });
    return;
  }

  const auth = resolveRoleFromHeader(req.headers.authorization);
  if (!auth.ok) {
    sendJson(res, 401, { jsonrpc: "2.0", id, error: { code: -32000, message: `Unauthorized: ${auth.reason}` } });
    return;
  }

  if (method === "tools/list") {
    const { status, body } = await forwardToDownstream(rpc);
    sendJson(res, status, body);
    return;
  }

  if (method === "tools/call") {
    const toolName: string | undefined = params?.name;
    if (typeof toolName === "string" && toolName.startsWith("admin_") && auth.role !== "admin") {
      sendJson(res, 200, {
        jsonrpc: "2.0",
        id,
        error: { code: -32001, message: "Unauthorized Tool Call" },
      });
      return;
    }
    const { status, body } = await forwardToDownstream(rpc);
    sendJson(res, status, body);
    return;
  }

  sendJson(res, 200, { jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown method: ${method}` } });
});

export function startGateway(port = Number(process.env.GATEWAY_PORT ?? 4001)) {
  return server.listen(port, () => {
    console.error(`[gateway] listening on http://localhost:${port}, forwarding to ${downstreamUrl()}`);
  });
}
