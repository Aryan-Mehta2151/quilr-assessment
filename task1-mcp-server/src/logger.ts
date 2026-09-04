// Keep stdout clean for MCP JSON-RPC frames.
export const logger = {
  info: (msg: string, meta?: unknown) => write("INFO", msg, meta),
  warn: (msg: string, meta?: unknown) => write("WARN", msg, meta),
  error: (msg: string, meta?: unknown) => write("ERROR", msg, meta),
};

function write(level: string, msg: string, meta?: unknown): void {
  const line = `[${new Date().toISOString()}] ${level} ${msg}${meta !== undefined ? " " + JSON.stringify(meta) : ""}\n`;
  process.stderr.write(line);
}
