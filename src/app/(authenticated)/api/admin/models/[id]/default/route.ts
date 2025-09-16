import { NextRequest } from "next/server";
import { getCurrentUser } from "@/features/auth-page/helpers";
import { setDefaultModel } from "@/server/repositories/modelRepository";

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

export async function POST(req: NextRequest, { params }: RouteParams) {
  const accessError = await checkAdminAccess();
  if (accessError) return accessError;

  try {
    const { id } = await params;
    
    const response = await setDefaultModel(id);
    
    if (response.status !== "OK") {
      return new Response(
        JSON.stringify({ 
          error: "Failed to set default model", 
          details: response.errors 
        }), 
        { 
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    return new Response(
      JSON.stringify({ message: "Default model updated successfully" }), 
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Failed to set default model:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }), 
      { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}
