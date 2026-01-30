import { ImageAPIEntry } from "@/features/chat-page/chat-services/images-api";
import { getServerSession } from "next-auth";
import { options } from "@/features/auth-page/auth-api";
import { FindChatThreadForCurrentUser } from "@/features/chat-page/chat-services/chat-thread-service";
import { GetThreadAndImageFromUrl } from "@/features/chat-page/chat-services/chat-image-service";

export async function GET(req: Request) {
  // Verify user session exists
  const session = await getServerSession(options);
  if (!session || !session.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  
  // Parse URL to get threadId
  const urlParseResult = await GetThreadAndImageFromUrl(req.url);
  if (urlParseResult.status !== "OK") {
    return new Response("Invalid image URL", { status: 400 });
  }
  
  const { threadId } = urlParseResult.response;
  
  // Verify user owns the thread
  const threadResult = await FindChatThreadForCurrentUser(threadId);
  if (threadResult.status !== "OK") {
    return new Response("Forbidden", { status: 403 });
  }
  
  return await ImageAPIEntry(req);
}