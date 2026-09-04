import { createServer, IncomingMessage, ServerResponse } from "node:http";

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createProviderServer(name: string) {
  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== "POST") {
      res.writeHead(405).end("Only POST supported");
      return;
    }
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};
    const simulate: string = body.providerBehavior?.[name] ?? body.simulate ?? "success";

    if (simulate === "429") {
      res.writeHead(429, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "rate limited by upstream provider" }));
      return;
    }

    if (simulate === "error") {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `Internal error at ${name}: NullPointerException in module xyz.js:142` }));
      return;
    }

    if (simulate === "timeout") {
      await sleep(10_000);
      res.writeHead(200).end("too late");
      return;
    }

    await sleep(body.delayMs ?? 20);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ text: `response from ${name}`, tokens: body.tokens ?? 100, provider: name }));
  });
}

export function startProvider(name: string, port: number) {
  return createProviderServer(name).listen(port, () => {
    console.error(`[provider:${name}] listening on http://localhost:${port}`);
  });
}
