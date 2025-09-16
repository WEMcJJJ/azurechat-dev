import { Container } from "@azure/cosmos";
import { CosmosInstance } from "@/features/common/services/cosmos";

const DATABASE_NAME = process.env.AZURE_COSMOSDB_DB_NAME || "chat";
const MODELS_CONTAINER_NAME = "models";

let modelsContainer: Container;

export const ModelsContainer = async (): Promise<Container> => {
  if (!modelsContainer) {
    const cosmosClient = CosmosInstance();
    modelsContainer = cosmosClient
      .database(DATABASE_NAME)
      .container(MODELS_CONTAINER_NAME);
  }
  return modelsContainer;
};
