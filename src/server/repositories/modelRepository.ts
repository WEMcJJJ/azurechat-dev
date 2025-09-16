"use server";
import "server-only";

import { SqlQuerySpec } from "@azure/cosmos";
import { ModelsContainer } from "@/server/services/modelsContainer";
import { ServerActionResponse } from "@/features/common/server-action-response";
import { uniqueId } from "@/features/common/util";
import { getCurrentUser, userHashedId } from "@/features/auth-page/helpers";
import { 
  ModelConfig, 
  PublicModel, 
  AdminModelView, 
  PROVIDER_AZURE_OPENAI,
  DEFAULT_SORT_ORDER,
  ModelConfigInput 
} from "@/types/models";
import { encryptSecret, decryptSecret } from "../services/cryptoService";
import { invalidateModelSetupCache } from "../services/modelSetupService";

// Constants for model management
const MODEL_ATTRIBUTE = "model";
const SYSTEM_USER_ID = "system";

// In-memory cache for enabled models (60 second TTL)
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL = 60 * 1000; // 60 seconds
let enabledModelsCache: CacheEntry<PublicModel[]> | null = null;
let defaultModelCache: CacheEntry<ModelConfig> | null = null;

function isCacheValid<T>(cache: CacheEntry<T> | null): boolean {
  return cache !== null && (Date.now() - cache.timestamp) < CACHE_TTL;
}

function invalidateCache(): void {
  enabledModelsCache = null;
  defaultModelCache = null;
  // Also invalidate the model setup cache
  invalidateModelSetupCache();
}

/**
 * Gets all enabled models for public consumption (dropdown, etc.)
 */
export async function listEnabledModels(): Promise<ServerActionResponse<PublicModel[]>> {
  try {
    // Check cache first
    if (isCacheValid(enabledModelsCache)) {
      return {
        status: "OK",
        response: enabledModelsCache!.data
      };
    }

    const querySpec: SqlQuerySpec = {
      query: "SELECT m.id, m.friendlyName, m.isDefault, m.sortOrder FROM root m WHERE m.type = @type AND m.userId = @userId AND m.enabled = @enabled",
      parameters: [
        { name: "@type", value: MODEL_ATTRIBUTE },
        { name: "@userId", value: SYSTEM_USER_ID },
        { name: "@enabled", value: true }
      ]
    };

    const container = await ModelsContainer();
    const { resources } = await container
      .items.query<PublicModel>(querySpec)
      .fetchAll();

    const models = resources.sort((a: PublicModel, b: PublicModel) => {
      const aSort = a.sortOrder ?? DEFAULT_SORT_ORDER;
      const bSort = b.sortOrder ?? DEFAULT_SORT_ORDER;
      if (aSort !== bSort) return aSort - bSort;
      return a.friendlyName.localeCompare(b.friendlyName);
    });

    // Update cache
    enabledModelsCache = {
      data: models,
      timestamp: Date.now()
    };

    return {
      status: "OK",
      response: models
    };
  } catch (error) {
    console.error('Failed to list enabled models:', error);
    return {
      status: "ERROR",
      errors: [{ message: `Failed to retrieve models: ${error}` }]
    };
  }
}

/**
 * Gets a model by ID with decrypted secrets (server-side only)
 */
export async function getModelById(id: string): Promise<ServerActionResponse<ModelConfig>> {
  try {
    const querySpec: SqlQuerySpec = {
      query: "SELECT * FROM root m WHERE m.type = @type AND m.userId = @userId AND m.id = @id",
      parameters: [
        { name: "@type", value: MODEL_ATTRIBUTE },
        { name: "@userId", value: SYSTEM_USER_ID },
        { name: "@id", value: id }
      ]
    };

    const container = await ModelsContainer();
    const { resources } = await container
      .items.query<ModelConfig>(querySpec)
      .fetchAll();

    if (resources.length === 0) {
      return {
        status: "NOT_FOUND",
        errors: [{ message: "Model not found" }]
      };
    }

    return {
      status: "OK",
      response: resources[0]
    };
  } catch (error) {
    console.error('Failed to get model by ID:', error);
    return {
      status: "ERROR",
      errors: [{ message: `Failed to retrieve model: ${error}` }]
    };
  }
}

/**
 * Gets the default model with decrypted secrets
 */
export async function getDefaultModel(): Promise<ServerActionResponse<ModelConfig>> {
  try {
    // Check cache first
    if (isCacheValid(defaultModelCache)) {
      return {
        status: "OK",
        response: defaultModelCache!.data
      };
    }

    const querySpec: SqlQuerySpec = {
      query: "SELECT * FROM root m WHERE m.type = @type AND m.userId = @userId AND m.isDefault = @isDefault AND m.enabled = @enabled",
      parameters: [
        { name: "@type", value: MODEL_ATTRIBUTE },
        { name: "@userId", value: SYSTEM_USER_ID },
        { name: "@isDefault", value: true },
        { name: "@enabled", value: true }
      ]
    };

    const container = await ModelsContainer();
    const { resources } = await container
      .items.query<ModelConfig>(querySpec)
      .fetchAll();

    if (resources.length === 0) {
      return {
        status: "NOT_FOUND",
        errors: [{ message: "No default model configured" }]
      };
    }

    if (resources.length > 1) {
      console.warn(`Multiple default models found (${resources.length}), using first one`);
    }

    const model = resources[0];

    // Update cache
    defaultModelCache = {
      data: model,
      timestamp: Date.now()
    };

    return {
      status: "OK",
      response: model
    };
  } catch (error) {
    console.error('Failed to get default model:', error);
    return {
      status: "ERROR",
      errors: [{ message: `Failed to retrieve default model: ${error}` }]
    };
  }
}

/**
 * Lists all models for admin view (no secrets)
 */
export async function listAllModelsForAdmin(): Promise<ServerActionResponse<AdminModelView[]>> {
  try {
    const user = await getCurrentUser();
    if (!user.isAdmin) {
      return {
        status: "ERROR",
        errors: [{ message: "Access denied. Admin privileges required." }]
      };
    }

    const querySpec: SqlQuerySpec = {
      query: "SELECT * FROM root m WHERE m.type = @type AND m.userId = @userId",
      parameters: [
        { name: "@type", value: MODEL_ATTRIBUTE },
        { name: "@userId", value: SYSTEM_USER_ID }
      ]
    };

    const container = await ModelsContainer();
    const { resources } = await container
      .items.query<ModelConfig>(querySpec)
      .fetchAll();

    // Sort in application code instead of database
    const sortedResources = resources.sort((a: ModelConfig, b: ModelConfig) => {
      // Sort by isDefault (true first), then enabled (true first), then sortOrder, then friendlyName
      if (a.isDefault !== b.isDefault) return b.isDefault ? 1 : -1;
      if (a.enabled !== b.enabled) return b.enabled ? 1 : -1;
      const aSort = a.sortOrder ?? DEFAULT_SORT_ORDER;
      const bSort = b.sortOrder ?? DEFAULT_SORT_ORDER;
      if (aSort !== bSort) return aSort - bSort;
      return a.friendlyName.localeCompare(b.friendlyName);
    });

    const adminModels: AdminModelView[] = sortedResources.map((model: ModelConfig) => ({
      id: model.id,
      provider: model.provider,
      friendlyName: model.friendlyName,
      instanceName: model.instanceName,
      deploymentName: model.deploymentName,
      apiVersion: model.apiVersion,
      enabled: model.enabled,
      isDefault: model.isDefault,
      sortOrder: model.sortOrder,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
      createdBy: model.createdBy,
      updatedBy: model.updatedBy,
      description: model.description,
      hasApiKey: Boolean(model.apiKeyEnc && model.apiKeyEnc.data)
    }));

    return {
      status: "OK",
      response: adminModels
    };
  } catch (error) {
    console.error('Failed to list models for admin:', error);
    return {
      status: "ERROR",
      errors: [{ message: `Failed to retrieve models: ${error}` }]
    };
  }
}

/**
 * Creates or updates a model configuration
 */
export async function upsertModel(
  input: ModelConfigInput,
  options: { rotateKey?: boolean } = {}
): Promise<ServerActionResponse<ModelConfig>> {
  try {
    const user = await getCurrentUser();
    if (!user.isAdmin) {
      return {
        status: "ERROR",
        errors: [{ message: "Access denied. Admin privileges required." }]
      };
    }

    const now = new Date().toISOString();
    const userId = await userHashedId();
    
    let model: ModelConfig;
    
    if (input.id) {
      // Update existing model
      const existingResponse = await getModelById(input.id);
      if (existingResponse.status !== "OK") {
        return existingResponse;
      }
      
      model = existingResponse.response;
      
      // Update fields
      model.friendlyName = input.friendlyName;
      model.instanceName = input.instanceName;
      model.deploymentName = input.deploymentName;
      model.apiVersion = input.apiVersion;
      model.enabled = input.enabled;
      model.sortOrder = input.sortOrder;
      model.updatedAt = now;
      model.updatedBy = userId;
      
      // Update API key if provided
      if (input.apiKeyPlaintext || options.rotateKey) {
        if (!input.apiKeyPlaintext) {
          return {
            status: "ERROR",
            errors: [{ message: "API key is required when rotating key" }]
          };
        }
        model.apiKeyEnc = await encryptSecret(input.apiKeyPlaintext);
      }
      
      // Handle default status changes
      if (input.isDefault && !model.isDefault) {
        const setDefaultResponse = await setDefaultModel(model.id);
        if (setDefaultResponse.status !== "OK") {
          return setDefaultResponse;
        }
        model.isDefault = true;
      } else if (!input.isDefault && model.isDefault) {
        // Don't allow removing default status - admin must set another model as default first
        const enabledModelsResponse = await listEnabledModels();
        if (enabledModelsResponse.status === "OK" && enabledModelsResponse.response.length <= 1) {
          return {
            status: "ERROR",
            errors: [{ message: "Cannot remove default status from the only enabled model" }]
          };
        }
        model.isDefault = false;
      }
    } else {
      // Create new model
      if (!input.apiKeyPlaintext) {
        return {
          status: "ERROR",
          errors: [{ message: "API key is required for new models" }]
        };
      }

      model = {
        id: uniqueId(),
        userId: SYSTEM_USER_ID,
        friendlyName: input.friendlyName,
        provider: 'azure-openai',
        instanceName: input.instanceName,
        deploymentName: input.deploymentName,
        apiVersion: input.apiVersion,
        apiKeyEnc: await encryptSecret(input.apiKeyPlaintext),
        enabled: input.enabled,
        isDefault: input.isDefault,
        sortOrder: input.sortOrder ?? DEFAULT_SORT_ORDER,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
        type: MODEL_ATTRIBUTE
      } as ModelConfig;

      // If this is marked as default, ensure it's the only default
      if (input.isDefault) {
        const setDefaultResponse = await setDefaultModel(model.id, model);
        if (setDefaultResponse.status !== "OK") {
          return setDefaultResponse;
        }
      }
    }

    // Save to database
    const container = await ModelsContainer();
    const { resource } = await container.items.upsert<ModelConfig>(model);

    if (!resource) {
      return {
        status: "ERROR",
        errors: [{ message: "Failed to save model configuration" }]
      };
    }

    // Invalidate cache
    invalidateCache();

    console.info(`Model ${input.id ? 'updated' : 'created'}: ${model.friendlyName} (${model.id})`, {
      modelId: model.id,
      friendlyName: model.friendlyName,
      enabled: model.enabled,
      isDefault: model.isDefault,
      userId
    });

    return {
      status: "OK",
      response: resource
    };
  } catch (error) {
    console.error('Failed to upsert model:', error);
    return {
      status: "ERROR",
      errors: [{ message: `Failed to save model: ${error}` }]
    };
  }
}

/**
 * Sets a model as the default (and unsets others)
 */
export async function setDefaultModel(
  modelId: string, 
  modelToSet?: ModelConfig
): Promise<ServerActionResponse<void>> {
  try {
    const user = await getCurrentUser();
    if (!user.isAdmin) {
      return {
        status: "ERROR",
        errors: [{ message: "Access denied. Admin privileges required." }]
      };
    }

    // Get the model to set as default if not provided
    let targetModel = modelToSet;
    if (!targetModel) {
      const modelResponse = await getModelById(modelId);
      if (modelResponse.status !== "OK") {
        return modelResponse;
      }
      targetModel = modelResponse.response;
    }

    if (!targetModel.enabled) {
      return {
        status: "ERROR",
        errors: [{ message: "Cannot set disabled model as default" }]
      };
    }

    // First, unset all other default models
    const querySpec: SqlQuerySpec = {
      query: "SELECT * FROM root m WHERE m.type = @type AND m.userId = @userId AND m.isDefault = @isDefault AND m.id != @excludeId",
      parameters: [
        { name: "@type", value: MODEL_ATTRIBUTE },
        { name: "@userId", value: SYSTEM_USER_ID },
        { name: "@isDefault", value: true },
        { name: "@excludeId", value: modelId }
      ]
    };

    const container = await ModelsContainer();
    const { resources } = await container
      .items.query<ModelConfig>(querySpec)
      .fetchAll();

    // Update all current default models to not be default
    const updatePromises = resources.map(async (model: ModelConfig) => {
      model.isDefault = false;
      model.updatedAt = new Date().toISOString();
      model.updatedBy = await userHashedId();
      return container.items.upsert<ModelConfig>(model);
    });

    await Promise.all(updatePromises);

    // Set the target model as default
    targetModel.isDefault = true;
    targetModel.updatedAt = new Date().toISOString();
    targetModel.updatedBy = await userHashedId();
    
    await container.items.upsert<ModelConfig>(targetModel);

    // Invalidate cache
    invalidateCache();

    console.info(`Set default model: ${targetModel.friendlyName} (${modelId})`, {
      modelId,
      friendlyName: targetModel.friendlyName,
      userId: await userHashedId()
    });

    return {
      status: "OK",
      response: undefined
    };
  } catch (error) {
    console.error('Failed to set default model:', error);
    return {
      status: "ERROR",
      errors: [{ message: `Failed to set default model: ${error}` }]
    };
  }
}

/**
 * Removes a model configuration
 */
export async function removeModel(modelId: string): Promise<ServerActionResponse<void>> {
  try {
    const user = await getCurrentUser();
    if (!user.isAdmin) {
      return {
        status: "ERROR",
        errors: [{ message: "Access denied. Admin privileges required." }]
      };
    }

    const modelResponse = await getModelById(modelId);
    if (modelResponse.status !== "OK") {
      return modelResponse;
    }

    const model = modelResponse.response;

    // Check if this is the only enabled model
    if (model.enabled) {
      const enabledModelsResponse = await listEnabledModels();
      if (enabledModelsResponse.status === "OK" && enabledModelsResponse.response.length <= 1) {
        return {
          status: "ERROR",
          errors: [{ message: "Cannot delete the only enabled model" }]
        };
      }
    }

    // Check if this is the default model
    if (model.isDefault) {
      const enabledModelsResponse = await listEnabledModels();
      if (enabledModelsResponse.status === "OK" && enabledModelsResponse.response.length <= 1) {
        return {
          status: "ERROR",
          errors: [{ message: "Cannot delete the default model when it's the only enabled model" }]
        };
      }
    }

    // Delete the model
    const container = await ModelsContainer();
    await container.item(modelId, modelId).delete();

    // If we deleted the default model, set another enabled model as default
    if (model.isDefault) {
      const enabledModelsResponse = await listEnabledModels();
      if (enabledModelsResponse.status === "OK" && enabledModelsResponse.response.length > 0) {
        const nextDefault = enabledModelsResponse.response[0];
        await setDefaultModel(nextDefault.id);
      }
    }

    // Invalidate cache
    invalidateCache();

    console.info(`Deleted model: ${model.friendlyName} (${modelId})`, {
      modelId,
      friendlyName: model.friendlyName,
      userId: await userHashedId()
    });

    return {
      status: "OK",
      response: undefined
    };
  } catch (error) {
    console.error('Failed to remove model:', error);
    return {
      status: "ERROR",
      errors: [{ message: `Failed to remove model: ${error}` }]
    };
  }
}

/**
 * System-level function to create models during migration (bypasses user auth)
 */
export async function createSystemModel(
  input: ModelConfigInput
): Promise<ServerActionResponse<ModelConfig>> {
  try {
    const now = new Date().toISOString();
    const modelId = input.id || uniqueId();
    
    // Encrypt the API key
    const encryptedKey = await encryptSecret(input.apiKeyPlaintext || '');
    
    const model: ModelConfig = {
      id: modelId,
      provider: 'azure-openai',
      friendlyName: input.friendlyName,
      instanceName: input.instanceName,
      deploymentName: input.deploymentName,
      apiVersion: input.apiVersion,
      apiKeyEnc: encryptedKey,
      enabled: input.enabled,
      isDefault: input.isDefault,
      sortOrder: input.sortOrder || DEFAULT_SORT_ORDER,
      createdAt: now,
      updatedAt: now,
      createdBy: 'system-migration',
      updatedBy: 'system-migration'
    };

    const container = await ModelsContainer();
    await container.items.create(model);
    
    // Clear cache since we've added a new model
    invalidateCache();

    console.log(`✅ Created system model: ${model.friendlyName} (${model.deploymentName})`);

    return {
      status: "OK",
      response: model
    };
  } catch (error) {
    console.error('Failed to create system model:', error);
    return {
      status: "ERROR",
      errors: [{ message: `Failed to save model: ${error}` }]
    };
  }
}
