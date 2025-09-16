import { ModelsContainer } from "./modelsContainer";

/**
 * Service for checking if models are properly configured
 */

export interface ModelSetupStatus {
  hasModels: boolean;
  availableModels: number;
  isSetupRequired: boolean;
}

// Cache for model setup status (5 second TTL)
let cachedStatus: ModelSetupStatus | null = null;
let cacheExpiry: number = 0;
const CACHE_TTL_MS = 5000; // 5 seconds

/**
 * Invalidate the setup status cache
 */
export function invalidateModelSetupCache(): void {
  cachedStatus = null;
  cacheExpiry = 0;
}

/**
 * Check if at least one model is configured in the system
 * @returns Promise<ModelSetupStatus> - Status of model configuration
 */
export async function checkModelSetup(): Promise<ModelSetupStatus> {
  // Check cache first
  const now = Date.now();
  if (cachedStatus && now < cacheExpiry) {
    return cachedStatus;
  }

  try {
    const modelsContainer = await ModelsContainer();
    
    // Query for any enabled models using the correct field names
    const querySpec = {
      query: "SELECT c.id FROM c WHERE c.type = @type AND c.enabled = @enabled",
      parameters: [
        { name: "@type", value: "model" },
        { name: "@enabled", value: true }
      ]
    };
    
    const { resources: models } = await modelsContainer.items
      .query(querySpec)
      .fetchAll();
    
    const availableModels = models.length;
    const hasModels = availableModels > 0;
    
    const status = {
      hasModels,
      availableModels,
      isSetupRequired: !hasModels
    };

    // Cache the result
    cachedStatus = status;
    cacheExpiry = now + CACHE_TTL_MS;
    
    return status;
  } catch (error: any) {
    // Handle specific case where models container doesn't exist
    if (error?.code === 404 || error?.message?.includes("Resource Not Found")) {
      console.warn("Models container does not exist - setup required");
      const status = {
        hasModels: false,
        availableModels: 0,
        isSetupRequired: true
      };
      
      // Cache the result
      cachedStatus = status;
      cacheExpiry = now + CACHE_TTL_MS;
      
      return status;
    }
    
    console.warn("Error checking model setup (assuming setup required):", error?.code || "UNKNOWN");
    // For other errors, assume setup is required
    const status = {
      hasModels: false,
      availableModels: 0,
      isSetupRequired: true
    };
    
    // Cache the result
    cachedStatus = status;
    cacheExpiry = now + CACHE_TTL_MS;
    
    return status;
  }
}

/**
 * Get a user-friendly message about the model setup status
 * @returns Promise<string> - Message describing what needs to be done
 */
export async function getModelSetupMessage(): Promise<string> {
  const status = await checkModelSetup();
  
  if (status.isSetupRequired) {
    return "No AI models are configured yet. An administrator needs to set up at least one AI model before chat functionality will be available.";
  }
  
  return `${status.availableModels} model(s) configured and ready for use.`;
}
