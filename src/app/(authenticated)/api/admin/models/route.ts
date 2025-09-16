import { NextRequest } from "next/server";
import { getCurrentUser } from "@/features/auth-page/helpers";
import { 
  listAllModelsForAdmin, 
  upsertModel 
} from "@/server/repositories/modelRepository";
import { ModelConfigInputSchema } from "@/server/validation/models";

async function checkAdminAccess() {
  try {
    const user = await getCurrentUser();
    if (!user.isAdmin) {
      return new Response(
        JSON.stringify({ error: "Access denied. Admin privileges required." }), 
        { 
          status: 403,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
    return null;
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Authentication failed" }), 
      { 
        status: 401,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}

export async function GET() {
  const accessError = await checkAdminAccess();
  if (accessError) return accessError;

  try {
    const response = await listAllModelsForAdmin();
    
    if (response.status !== "OK") {
      return new Response(
        JSON.stringify({ 
          error: "Failed to retrieve models", 
          details: response.errors 
        }), 
        { 
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    return new Response(
      JSON.stringify(response.response), 
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Failed to get admin models:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }), 
      { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}

export async function POST(req: NextRequest) {
  const accessError = await checkAdminAccess();
  if (accessError) return accessError;

  try {
    const body = await req.json();
    
    // Validate input
    const validationResult = ModelConfigInputSchema.safeParse(body);
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ 
          error: "Validation failed", 
          details: validationResult.error.errors 
        }), 
        { 
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const modelInput = validationResult.data;

    // For new models, require API key
    if (!modelInput.id && !modelInput.apiKeyPlaintext) {
      return new Response(
        JSON.stringify({ error: "API key is required for new models" }), 
        { 
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const response = await upsertModel(modelInput);
    
    if (response.status !== "OK") {
      return new Response(
        JSON.stringify({ 
          error: "Failed to create model", 
          details: response.errors 
        }), 
        { 
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Return response without sensitive data
    const { apiKeyEnc, ...safeModel } = response.response;
    
    return new Response(
      JSON.stringify({ 
        ...safeModel, 
        hasApiKey: Boolean(apiKeyEnc?.data) 
      }), 
      {
        status: 201,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Failed to create model:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }), 
      { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}
