import { NextRequest } from "next/server";
import { listEnabledModels } from "@/server/repositories/modelRepository";
import { PublicModel } from "@/types/models";

export async function GET(req: NextRequest) {
  try {
    // Get models from database only
    const modelsResponse = await listEnabledModels();
    
    if (modelsResponse.status !== "OK") {
      console.error("Failed to fetch models:", modelsResponse.errors);
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    // Convert to public model format
    const publicModels: PublicModel[] = modelsResponse.response.map((model) => ({
      id: model.id,
      friendlyName: model.friendlyName,
      isDefault: model.isDefault
    }));
    
    return new Response(JSON.stringify(publicModels), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in models API:", error);
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}
