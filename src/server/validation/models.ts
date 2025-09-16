import { z } from "zod";

// Validation schema for model configuration input
export const ModelConfigInputSchema = z.object({
  id: z.string().optional(),
  friendlyName: z.string().min(1, "Friendly name is required").max(100, "Friendly name too long"),
  instanceName: z.string().min(1, "Instance name is required").max(50, "Instance name too long"),
  deploymentName: z.string().min(1, "Deployment name is required").max(50, "Deployment name too long"),
  apiVersion: z.string().min(1, "API version is required").regex(/^\d{4}-\d{2}-\d{2}(-preview)?$/, "Invalid API version format"),
  apiKeyPlaintext: z.string().optional(),
  enabled: z.boolean(),
  isDefault: z.boolean(),
  sortOrder: z.number().int().min(0).max(999).optional()
});

// Validation for public API calls
export const PublicModelQuerySchema = z.object({
  enabled: z.boolean().optional()
});

// Validation for setting default model
export const SetDefaultModelSchema = z.object({
  modelId: z.string().min(1, "Model ID is required")
});

// Export inferred types
export type ModelConfigInputType = z.infer<typeof ModelConfigInputSchema>;
export type PublicModelQueryType = z.infer<typeof PublicModelQuerySchema>;
export type SetDefaultModelType = z.infer<typeof SetDefaultModelSchema>;
