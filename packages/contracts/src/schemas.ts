import { z } from "zod";

export const correlationIdSchema = z.string().trim().min(1).max(128);

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  correlationId: correlationIdSchema.nullable()
});
