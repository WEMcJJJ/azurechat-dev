"use client";

import { Button } from "@/features/ui/button";
import { Pencil } from "lucide-react";
import { FC } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { NewsArticleModel } from "./news-model";
import { ArticleCardContextMenu } from "./news-card-context-menu";
import { newsStore } from "./news-store";

interface Props {
  article: NewsArticleModel;
  showContextMenu: boolean;
}

export const ArticleCard: FC<Props> = (props) => {
  const { article } = props;
  return (
    <Card key={article.id} className="flex flex-col">
      <CardHeader className="flex flex-row">
        <CardTitle className="flex-1">{article.title}</CardTitle>
        {props.showContextMenu && (
          <div>
            <ArticleCardContextMenu article={article} />
          </div>
        )}
      </CardHeader>
      <CardContent className="text-muted-foreground flex-1">
        {article.isPublished
          ? <><div className="text-green-500 w-full flex justify-left">Published</div><br></br></>
          : <><div className="text-red-500 w-full flex justify-left">Unpublished</div><br></br></>
        }
        {article.description.length > 100
          ? article.description.slice(0, 100).concat("...")
          : article.description}
      </CardContent>
      <CardFooter className="gap-1 content-stretch f">
        {props.showContextMenu && (
          <Button
            variant={"outline"}
            title="Edit Article"
            onClick={() => newsStore.updateArticle(props.article)}
          >
            <Pencil size={18} />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};
