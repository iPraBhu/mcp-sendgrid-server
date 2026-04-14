/**
 * Common reusable Zod schemas used across multiple domains.
 */

import { z } from "zod";

export const EmailAddressSchema = z.string().email().describe("Valid email address");

export const EmailPersonalizationSchema = z.object({
  email: EmailAddressSchema,
  name: z.string().optional().describe("Display name"),
});

export const DateRangeSchema = z.object({
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
    .describe("Start date (YYYY-MM-DD)"),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
    .describe("End date (YYYY-MM-DD)"),
});

export const PaginationSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(500)
    .optional()
    .describe("Number of results to return (default: 25, max: 100)"),
  offset: z.number().int().min(0).optional().describe("Offset for pagination (default: 0)"),
});

export const PagePaginationSchema = z.object({
  page: z.number().int().min(1).optional().describe("Page number (default: 1)"),
  page_size: z.number().int().min(1).max(200).optional().describe("Page size (default: 25)"),
});
