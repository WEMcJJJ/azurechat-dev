"use client";
import { Hero, HeroButton } from "@/features/ui/hero";
import { Book, Newspaper } from "lucide-react";
import { newsStore } from "../news-store";

export const NewsHero = () => {
  return (
    <Hero
      title={
        <>
          <Newspaper size={36} strokeWidth={1.5} /> News Articles
        </>
      }
      description={
        "News articles for display on the home page. Add, edit, or delete news articles."
      }
    >
      <HeroButton
        title="Add New Article"
        description="Add a new article to the news page."
        icon={<Newspaper />}
        onClick={() => newsStore.newArticle()}
      />
    </Hero>
  );
};
