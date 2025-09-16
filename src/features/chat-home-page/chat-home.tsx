"use client";

import { ExtensionModel } from "@/features/extensions-page/extension-services/models";
import { PersonaCard } from "@/features/persona-page/persona-card/persona-card";
import { PersonaModel } from "@/features/persona-page/persona-services/models";
import { AI_DESCRIPTION, AI_NAME } from "@/features/theme/theme-config";
import { Hero } from "@/features/ui/hero";
import { ScrollArea } from "@/features/ui/scroll-area";
import Image from "next/image";
import { FC, useState } from "react";
import { NewsArticleModel } from "@/features/news-page/news-model";
import { NewsArticle } from "./news-article";
import { Button } from "../ui/button";
import { ExternalLink, House, Logs } from "lucide-react";
import { Changelog } from "./changelog";
import { MenuTrayToggle } from "@/features/main-menu/menu-tray-toggle";
import { useFeedbackLink } from "@/features/common/use-feedback-link";

interface ChatPersonaProps {
  personas: PersonaModel[];
  extensions: ExtensionModel[];
  news: NewsArticleModel[];
}

const FeedbackButton = ({ feedBackLink }: { feedBackLink: string }) => {
  if (!feedBackLink) return null;
  return (
    <Button
      variant="ghost"
      className="flex items-center gap-3"
      onClick={() => window.open(feedBackLink, "_blank")}
    >
      <ExternalLink className="h-5 w-5" />
      Report Feedback
    </Button>
  );
};

const HomeButton = ({ onClick }: { onClick: () => void }) => (
  <Button variant="ghost" className="flex items-center gap-3" onClick={onClick}>
    <House className="h-5 w-5" />
    <p>Home</p>
  </Button>
);

const ChangelogButton = ({ onClick }: { onClick: () => void }) => (
  <Button variant="ghost" className="gap-3" onClick={onClick}>
    <Logs className="h-5 w-5" />
    <p>Changelog</p>
  </Button>
);

const ChangelogSection = ({
  setShowChangelog,
  feedbackLink,
}: {
  setShowChangelog: (arg0: boolean) => void;
  feedbackLink: string | null;
}) => (
  <div>
    <div className="flex justify-between">
      <h2 className="text-2xl font-bold mb-3">Changelog</h2>
      <div className="flex gap-2">
        {feedbackLink && <FeedbackButton feedBackLink={feedbackLink} />}
        <HomeButton onClick={() => setShowChangelog(false)} />
      </div>
    </div>
    <Changelog />
  </div>
);

const ArticlesSection = ({
  news,
  setShowChangelog,
  feedbackLink,
}: {
  news: NewsArticleModel[];
  setShowChangelog: (arg0: boolean) => void;
  feedbackLink: string | null;
}) => (
  <div>
    <div className="flex justify-between">
      <h2 className="text-2xl font-bold mb-3">Articles</h2>
      <div className="flex gap-2">
        {feedbackLink && <FeedbackButton feedBackLink={feedbackLink} />}
        <ChangelogButton onClick={() => setShowChangelog(true)} />
      </div>
    </div>
    <div className="space-y-4">
      {news && news.length > 0 ? (
        news.map((newsArticle) => (
          <NewsArticle newsArticle={newsArticle} key={newsArticle.id} />
        ))
      ) : (
        <p className="text-muted-foreground max-w-xl">No current news</p>
      )}
    </div>
  </div>
);

const PersonasSection = ({ personas }: { personas: PersonaModel[] }) => (
  <div>
    <h2 className="text-2xl font-bold mb-3">Personas</h2>
    {personas && personas.length > 0 ? (
      <div className="grid grid-cols-3 gap-3">
        {personas.map((persona: PersonaModel) => (
          <PersonaCard
            persona={persona}
            key={persona.id}
            showContextMenu={false}
            showActionMenu={false}
          />
        ))}
      </div>
    ) : (
      <p className="text-muted-foreground max-w-xl">No personas created</p>
    )}
  </div>
);

export const ChatHome: FC<ChatPersonaProps> = ({ personas, news }) => {
  const [showChangelog, setShowChangelog] = useState<boolean>(false);
  const feedbackLink = useFeedbackLink();
  return (
    <ScrollArea className="flex-1 px-3">
      <main className="flex flex-1 flex-col gap-6 pb-6">
        <Hero
          title={
            <>
              <Image
                src={"/ai-icon.png"}
                width={60}
                height={60}
                quality={100}
                alt="ai-icon"
              />{" "}
              {AI_NAME}
            </>
          }
          description={AI_DESCRIPTION}
        />
        <div className="container max-w-4xl flex gap-20 flex-col">
        <div>
            <h2 className="text-2xl font-bold mb-3">Welcome to WestEd Chat</h2>
            <p className="text-muted-foreground max-w-xl">Click the &apos;+ New Chat&apos; button in the top left to start a new chat.</p>
            <br></br>
            <p className="text-muted-foreground max-w-xl">If you don&apos;t see the &apos;+ New Chat&apos; button, you might have to toggle the menu by clicking the following icon in the top left of the menu bar (or the one below):</p>
            <MenuTrayToggle />
            <br></br>
            <p className="text-muted-foreground max-w-xl">For additional information about how to use WestEd Chat, see the <a target="_blank" className="underline text-blue-600 hover:text-blue-800 visited:text-purple-600" href="https://westedintranet--simpplr.vf.force.com/apex/simpplr__app?u=/site/a076T00001hzhWtQAI/page/a01VO000005h6YjYAI">WestEd AI article</a> on Inside WestEd.</p>
            <br></br>
            <p className="text-muted-foreground max-w-xl">To learn more about AI at WestEd, visit the <a target="_blank" className="underline text-blue-600 hover:text-blue-800 visited:text-purple-600" href="https://westedintranet--simpplr.vf.force.com/apex/simpplr__app?u=/site/a076T00001hzhWtQAI/dashboard">AI Hub</a> on Inside WestEd.</p>
          </div>
        </div>

        <div className="container max-w-4xl flex gap-20 flex-col">
          {showChangelog ? (
            <ChangelogSection feedbackLink={feedbackLink} setShowChangelog={setShowChangelog} />
          ) : (
            <>
              <ArticlesSection
                news={news}
                setShowChangelog={setShowChangelog}
                feedbackLink={feedbackLink}
              />
              <PersonasSection personas={personas} />
            </>
          )}
        </div>
      </main>
    </ScrollArea>
  );
};
