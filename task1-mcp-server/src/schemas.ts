import { z } from "zod";

const customerIdPattern = /^CUST-\d{5}$/;

export const getCustomerRecordSchema = z.object({
  customer_id: z.string().regex(customerIdPattern, "customer_id must match CUST-XXXXX (5 digits)"),
});
export type GetCustomerRecordInput = z.infer<typeof getCustomerRecordSchema>;

export const triggerRefundSchema = z.object({
  customer_id: z.string().regex(customerIdPattern, "customer_id must match CUST-XXXXX (5 digits)"),
  amount: z.number().positive("amount must be a positive number"),
  reason: z.string().min(10, "reason must be at least 10 characters"),
});
export type TriggerRefundInput = z.infer<typeof triggerRefundSchema>;

export const getCustomerRecordJsonSchema = {
  type: "object",
  properties: {
    customer_id: { type: "string", pattern: "^CUST-\\d{5}$", description: "Customer ID formatted as CUST-XXXXX" },
  },
  required: ["customer_id"],
  additionalProperties: false,
};

export const triggerRefundJsonSchema = {
  type: "object",
  properties: {
    customer_id: { type: "string", pattern: "^CUST-\\d{5}$", description: "Customer ID formatted as CUST-XXXXX" },
    amount: { type: "number", exclusiveMinimum: 0, description: "Refund amount, must be positive" },
    reason: { type: "string", minLength: 10, description: "Reason for refund, minimum 10 characters" },
  },
  required: ["customer_id", "amount", "reason"],
  additionalProperties: false,
};
