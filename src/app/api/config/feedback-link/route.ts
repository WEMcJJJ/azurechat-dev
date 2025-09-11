// Exposes the feedback link at runtime so that updates to the App Setting
// in Azure do not require a new build. This route is intentionally dynamic.
// Set (or update) the App Setting NEXT_PUBLIC_FEEDBACK_LINK in the Azure Web App.
// Returns: { feedbackLink: string | null }
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    feedbackLink: process.env.NEXT_PUBLIC_FEEDBACK_LINK || null,
  });
}
