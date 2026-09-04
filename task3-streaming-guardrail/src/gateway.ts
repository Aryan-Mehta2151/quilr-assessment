import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { StreamRedactor } from "./redactor.js";

function llmMockUrl() {
  return process.env.LLM_MOCK_URL ?? "http://localhost:5000";
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  if (req.method !== "POST") {
    res.writeHead(405).end("Only POST supported");
    return;
  }

  const raw = await readBody(req);

  const upstream = await fetch(llmMockUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: raw,
  });

  if (!upstream.ok || !upstream.body) {
    res.writeHead(upstream.status).end("Upstream error");
    return;
  }

  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Transfer-Encoding": "chunked" });

  const redactor = new StreamRedactor();
  const decoder = new TextDecoder();
  const reader = upstream.body.getReader();

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const safeText = redactor.push(decoder.decode(value, { stream: true }));
    if (safeText) res.write(safeText);
  }

  const remainder = redactor.flush();
  if (remainder) res.write(remainder);
  res.end();
});

export function startGateway(port = Number(process.env.GATEWAY_PORT ?? 5001)) {
  return server.listen(port, () => {
    console.error(`[guardrail-gateway] listening on http://localhost:${port}, upstream ${llmMockUrl()}`);
  });
}
