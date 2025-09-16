import { NextRequest } from "next/server";
import { UpdateChatThreadImageModel } from "@/features/chat-page/chat-services/chat-thread-service";
import { userHashedId } from "@/features/auth-page/helpers";

export async function POST(request: NextRequest) {
  try {
    const { chatThreadId, imageModelId } = await request.json();

    if (!chatThreadId || !imageModelId) {
      return Response.json(
        { error: "Missing chatThreadId or imageModelId" },
        { status: 400 }
      );
    }

    // Verify user is authenticated
    const currentUserId = await userHashedId();
    if (!currentUserId) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const result = await UpdateChatThreadImageModel(chatThreadId, imageModelId);

    if (result.status === "OK") {
      return Response.json({ success: true, chatThread: result.response });
    } else {
      return Response.json(
        { error: result.errors?.[0]?.message || "Update failed" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error updating chat thread image model:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
