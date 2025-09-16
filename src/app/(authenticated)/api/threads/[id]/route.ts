import { NextRequest } from "next/server";
import { getCurrentUser } from "@/features/auth-page/helpers";
import { FindChatThreadForCurrentUser, UpsertChatThread } from "@/features/chat-page/chat-services/chat-thread-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }), 
        { 
          status: 401,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const { id } = await params;
    const body = await req.json();
    
    if (!body.modelId) {
      return new Response(
        JSON.stringify({ error: "modelId is required" }), 
        { 
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Get the chat thread
    const threadResponse = await FindChatThreadForCurrentUser(id);
    if (threadResponse.status !== "OK") {
      return new Response(
        JSON.stringify({ 
          error: threadResponse.status === "NOT_FOUND" ? "Chat thread not found" : "Failed to retrieve chat thread",
          details: threadResponse.errors 
        }), 
        { 
          status: threadResponse.status === "NOT_FOUND" ? 404 : 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Update the model ID
    const updatedThread = {
      ...threadResponse.response,
      modelId: body.modelId
    };

    const updateResponse = await UpsertChatThread(updatedThread);
    if (updateResponse.status !== "OK") {
      return new Response(
        JSON.stringify({ 
          error: "Failed to update chat thread", 
          details: updateResponse.errors 
        }), 
        { 
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        message: "Chat thread model updated successfully",
        modelId: body.modelId 
      }), 
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Failed to update chat thread model:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }), 
      { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}
