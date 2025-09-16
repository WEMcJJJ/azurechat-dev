import { ChatHome } from "@/features/chat-home-page/chat-home";
import { FindPublishedNewsArticles } from "@/features/news-page/news-service";
import { FindAllExtensionForCurrentUser } from "@/features/extensions-page/extension-services/extension-service";
import { FindAllPersonaForCurrentUser } from "@/features/persona-page/persona-services/persona-service";
import { DisplayError } from "@/features/ui/error/display-error";
import { checkModelSetup, getModelSetupMessage } from "@/server/services/modelSetupService";
import { ModelSetupRequired } from "@/features/chat-home-page/model-setup-required";

export default async function Home() {
  const [personaResponse, extensionResponse, newsResponse, modelSetup] = await Promise.all([
    FindAllPersonaForCurrentUser(),
    FindAllExtensionForCurrentUser(),
    FindPublishedNewsArticles(),
    checkModelSetup(),
  ]);

  if (personaResponse.status !== "OK") {
    return <DisplayError errors={personaResponse.errors} />;
  }

  if (extensionResponse.status !== "OK") {
    return <DisplayError errors={extensionResponse.errors} />;
  }

  if (newsResponse.status !== "OK") {
    return <DisplayError errors={newsResponse.errors} />;
  }

  // If models are not set up, show setup required page
  if (modelSetup.isSetupRequired) {
    const setupMessage = await getModelSetupMessage();
    return <ModelSetupRequired message={setupMessage} />;
  }

  return (
    <ChatHome
      personas={personaResponse.response}
      extensions={extensionResponse.response}
      news={newsResponse.response}
    />
  );
}
