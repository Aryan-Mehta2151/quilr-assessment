import { createServer, IncomingMessage, ServerResponse } from "node:http";

const TOOLS = [
  { name: "get_weather", description: "Get current weather for a city" },
  { name: "admin_reset_key", description: "Rotate an API key (admin only)" },
];

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(payload);
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

  const { id, method, params } = rpc;

  if (method === "tools/list") {
    sendJson(res, 200, { jsonrpc: "2.0", id, result: { tools: TOOLS } });
    return;
  }

  if (method === "tools/call") {
    const toolName = params?.name;
    const tool = TOOLS.find((t) => t.name === toolName);
    if (!tool) {
      sendJson(res, 200, { jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown tool: ${toolName}` } });
      return;
    }
    sendJson(res, 200, {
      jsonrpc: "2.0",
      id,
      result: { content: [{ type: "text", text: `${toolName} executed successfully (downstream mock)` }] },
    });
    return;
  }

  sendJson(res, 200, { jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown method: ${method}` } });
});

export function startDownstreamMock(port = Number(process.env.DOWNSTREAM_PORT ?? 4000)) {
  return server.listen(port, () => {
    console.error(`[downstream-mock] listening on http://localhost:${port}`);
  });
}
