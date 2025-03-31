import { FC } from "react";

import { DisplayError } from "../ui/error/display-error";
import { ScrollArea } from "../ui/scroll-area";
import { AddArticleSlider } from "./add-new-article";
import { ArticleCard } from "./news-card";
import { NewsHero } from "./news-hero/news-hero";
import { FindAllNewsArticles } from "./news-service";

interface ChatSampleArticleProps {}

export const ChatSampleArticlePage: FC<ChatSampleArticleProps> = async (
  props
) => {
  const articlesResponse = await FindAllNewsArticles();

  if (articlesResponse.status !== "OK") {
    return <DisplayError errors={articlesResponse.errors} />;
  }

  return (
    <ScrollArea className="flex-1">
      <main className="flex flex-1 flex-col">
        <NewsHero />
        <div className="container max-w-4xl py-3">
          <div className="grid grid-cols-3 gap-3">
            {articlesResponse.response.map((article) => {
              return (
                <ArticleCard article={article} key={article.id} showContextMenu />
              );
            })}
          </div>
        </div>
        <AddArticleSlider />
      </main>
    </ScrollArea>
  );
};
