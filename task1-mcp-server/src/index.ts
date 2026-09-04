import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import {
  getCustomerRecordJsonSchema,
  getCustomerRecordSchema,
  triggerRefundJsonSchema,
  triggerRefundSchema,
} from "./schemas.js";
import { logger } from "./logger.js";

const server = new Server(
  { name: "task1-mcp-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_customer_record",
        description: "Fetch a customer record by customer ID",
        inputSchema: getCustomerRecordJsonSchema,
      },
      {
        name: "trigger_refund",
        description: "Trigger a refund for a customer",
        inputSchema: triggerRefundJsonSchema,
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  logger.info("tool call received", { name });

  switch (name) {
    case "get_customer_record": {
      const parsed = getCustomerRecordSchema.safeParse(args);
      if (!parsed.success) {
        throw new McpError(ErrorCode.InvalidParams, formatZodIssues(parsed.error));
      }
      const record = {
        customer_id: parsed.data.customer_id,
        name: "Jane Doe",
        email: "jane.doe@example.com",
        status: "active",
      };
      return { content: [{ type: "text", text: JSON.stringify(record) }] };
    }

    case "trigger_refund": {
      const parsed = triggerRefundSchema.safeParse(args);
      if (!parsed.success) {
        throw new McpError(ErrorCode.InvalidParams, formatZodIssues(parsed.error));
      }
      const confirmation = {
        customer_id: parsed.data.customer_id,
        amount: parsed.data.amount,
        reason: parsed.data.reason,
        status: "refund_initiated",
        refund_id: `RFND-${Math.random().toString(36).slice(2, 10)}`,
      };
      return { content: [{ type: "text", text: JSON.stringify(confirmation) }] };
    }

    default:
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  }
});

function formatZodIssues(error: { issues: { path: (string | number)[]; message: string }[] }): string {
  return error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ");
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("task1-mcp-server started on stdio");
}

main().catch((err) => {
  logger.error("fatal startup error", { message: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
