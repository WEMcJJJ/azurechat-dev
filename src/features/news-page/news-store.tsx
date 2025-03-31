import { proxy, useSnapshot } from "valtio";
import { RevalidateCache } from "../common/navigation-helpers";
import { ServerActionResponse } from "../common/server-action-response";
import { NEWS_ARTICLE, NewsArticleModel } from "./news-model";
import { CreateArticle, UpsertArticle } from "./news-service";

class ArticleState {
  private defaultModel: NewsArticleModel = {
    id: "",
    title: "",
    description: "",
    link: "",
    createdAt: new Date(),
    type: "NEWS_ARTICLE",
    isPublished: false,
  };

  public errors: string[] = [];
  public article: NewsArticleModel = { ...this.defaultModel };
  public isOpened: boolean = false;

  public newArticle() {
    this.article = {
      ...this.defaultModel,
    };
    this.isOpened = true;
  }

  public updateOpened(value: boolean) {
    this.isOpened = value;
  }

  public updateArticle(article: NewsArticleModel) {
    this.article = {
      ...article,
    };
    this.isOpened = true;
  }

  public updateErrors(errors: string[]) {
    this.errors = errors;
  }
}

export const newsStore = proxy(new ArticleState());

export const useArticleState = () => {
  return useSnapshot(newsStore, {
    sync: true,
  });
};

export const addOrUpdateArticle = async (
  previous: any,
  formData: FormData
): Promise<ServerActionResponse<NewsArticleModel>> => {
  newsStore.updateErrors([]);

  const model = FormDataToArticleModel(formData);

  const response =
    model.id && model.id !== ""
      ? await UpsertArticle(model)
      : await CreateArticle(model);

  if (response.status === "OK") {
    newsStore.updateOpened(false);
    RevalidateCache({
      page: "news",
    });
  } else {
    newsStore.updateErrors(response.errors.map((e) => e.message));
  }
  return response;
};

export const FormDataToArticleModel = (formData: FormData): NewsArticleModel => {
  return {
    id: formData.get("id") as string,
    title: formData.get("title") as string,
    description: formData.get("description") as string,
    link: formData.get("link") as string,
    isPublished: formData.get("isPublished") === "on" ? true : false,
    createdAt: new Date(),
    type: NEWS_ARTICLE,
  };
};
