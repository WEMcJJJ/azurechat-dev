import { NextRequest } from "next/server";
import { getCurrentUser } from "@/features/auth-page/helpers";
import { 
  getModelById,
  upsertModel, 
  removeModel,
  setDefaultModel 
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

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const accessError = await checkAdminAccess();
  if (accessError) return accessError;

  try {
    const { id } = await params;
    const body = await req.json();
    
    // Validate input
    const validationResult = ModelConfigInputSchema.safeParse({ ...body, id });
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
    
    // Check if model exists
    const existingResponse = await getModelById(id);
    if (existingResponse.status !== "OK") {
      return new Response(
        JSON.stringify({ error: "Model not found" }), 
        { 
          status: 404,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const response = await upsertModel(modelInput);
    
    if (response.status !== "OK") {
      return new Response(
        JSON.stringify({ 
          error: "Failed to update model", 
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
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Failed to update model:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }), 
      { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const accessError = await checkAdminAccess();
  if (accessError) return accessError;

  try {
    const { id } = await params;
    
    const response = await removeModel(id);
    
    if (response.status !== "OK") {
      return new Response(
        JSON.stringify({ 
          error: "Failed to delete model", 
          details: response.errors 
        }), 
        { 
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    return new Response(
      JSON.stringify({ message: "Model deleted successfully" }), 
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Failed to delete model:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }), 
      { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}
