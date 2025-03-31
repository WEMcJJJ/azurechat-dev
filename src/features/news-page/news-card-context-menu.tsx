"use client";

import { MoreVertical, Pencil, Trash } from "lucide-react";
import { FC, useState } from "react";
import { DropdownMenuItemWithIcon } from "../chat-page/chat-menu/chat-menu-item";
import { RevalidateCache } from "../common/navigation-helpers";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { LoadingIndicator } from "../ui/loading";
import { NewsArticleModel } from "./news-model";
import { DeleteArticle } from "./news-service";
import { newsStore } from "./news-store";

interface Props {
  article: NewsArticleModel;
}

type DropdownAction = "delete";

export const ArticleCardContextMenu: FC<Props> = (props) => {
  const { isLoading, handleAction } = useDropdownAction({
    article: props.article,
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger>
          {isLoading ? (
            <LoadingIndicator isLoading={isLoading} />
          ) : (
            <MoreVertical size={18} />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItemWithIcon
            onClick={() => newsStore.updateArticle(props.article)}
          >
            <Pencil size={18} />
            <span>Edit</span>
          </DropdownMenuItemWithIcon>
          <DropdownMenuItemWithIcon
            onClick={async () => await handleAction("delete")}
          >
            <Trash size={18} />
            <span>Delete</span>
          </DropdownMenuItemWithIcon>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};

const useDropdownAction = (props: { article: NewsArticleModel }) => {
  const { article } = props;
  const [isLoading, setIsLoading] = useState(false);

  const handleAction = async (action: DropdownAction) => {
    setIsLoading(true);
    switch (action) {
      case "delete":
        if (window.confirm(`Are you sure you want to delete ${article.title}?`)) {
          await DeleteArticle(article.id);
          RevalidateCache({
            page: "news",
          });
        }

        break;
    }
    setIsLoading(false);
  };

  return {
    isLoading,
    handleAction,
  };
};
