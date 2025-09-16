// Model configuration types for Azure OpenAI
export interface EncryptedSecret {
  data: string;
  iv: string;
  tag: string;
}

export interface ModelConfig {
  id: string;
  provider: 'azure-openai'; // Partition key - grouping by provider type
  friendlyName: string;
  instanceName: string;
  deploymentName: string;
  apiVersion: string;
  apiKeyEnc: EncryptedSecret;
  enabled: boolean;
  isDefault: boolean;
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string; // User ID or email of the admin who created this
  updatedBy: string; // User ID or email of the admin who last updated this
  description?: string; // Optional description for the model
}

// Public model data for client consumption (no sensitive data)
export type PublicModel = Pick<ModelConfig, 'id' | 'friendlyName' | 'isDefault' | 'sortOrder' | 'description'>;

// Admin-only full model data (excludes encrypted key)
export type AdminModelView = Omit<ModelConfig, 'apiKeyEnc'> & {
  hasApiKey: boolean;
};

// For creation/update requests from admin UI
export interface ModelConfigInput {
  id?: string;
  friendlyName: string;
  instanceName: string;
  deploymentName: string;
  apiVersion: string;
  apiKeyPlaintext?: string; // Only provided when setting/updating key
  enabled: boolean;
  isDefault: boolean;
  sortOrder?: number;
  description?: string;
}

// Constants
export const PROVIDER_AZURE_OPENAI = 'azure-openai';
export const DEFAULT_API_VERSION = '2024-10-21';
export const DEFAULT_SORT_ORDER = 100;
