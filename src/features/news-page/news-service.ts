"use server";
import "server-only";

import {
  NEWS_ARTICLE,
  NewsArticleModel,
  NewsArticleModelSchema,
} from "@/features/news-page/news-model";
import { getCurrentUser, userHashedId } from "../auth-page/helpers";
import { uniqueId } from "../common/util";

import { ConfigContainer } from "@/features/common/services/cosmos";

import { ServerActionResponse, zodErrorsToServerActionErrors } from "@/features/common/server-action-response";
import { SqlQuerySpec } from "@azure/cosmos";

export const CreateArticle = async (
  props: NewsArticleModel
): Promise<ServerActionResponse<NewsArticleModel>> => {
  try {
    const user = await getCurrentUser();

    if (!user.isAdmin) {
      return {
        status: "UNAUTHORIZED",
        errors: [
          {
            message: `Unable to create article - admin role required.`,
          },
        ],
      };
    }

    const modelToSave: NewsArticleModel = {
      id: uniqueId(),
      title: props.title,
      description: props.description,
      link: props.link,
      isPublished: user.isAdmin ? props.isPublished : false,
      createdAt: new Date(),
      type: "NEWS_ARTICLE",
    };

    const valid = ValidateSchema(modelToSave);

    if (valid.status !== "OK") {
      return valid;
    }

    const { resource } = await ConfigContainer().items.create<NewsArticleModel>(
      modelToSave
    );

    if (resource) {
      return {
        status: "OK",
        response: resource,
      };
    } else {
      return {
        status: "ERROR",
        errors: [
          {
            message: "Error creating article",
          },
        ],
      };
    }
  } catch (error) {
    return {
      status: "ERROR",
      errors: [
        {
          message: `Error creating article: ${error}`,
        },
      ],
    };
  }
};

export const FindAllNewsArticles = async (
): Promise<ServerActionResponse<Array<NewsArticleModel>>> => {
  try {
    const querySpec: SqlQuerySpec = {
      query:
        "SELECT * FROM root r WHERE r.type=@type ORDER BY r.createdAt DESC",
      parameters: [
        {
          name: "@type",
          value: NEWS_ARTICLE,
        }
      ],
    };

    const { resources } = await ConfigContainer()
      .items.query<NewsArticleModel>(querySpec)
      .fetchAll();

    if (resources) {
      return {
        status: "OK",
        response: resources,
      };
    } else {
      return {
        status: "ERROR",
        errors: [
          {
            message: "No news found",
          },
        ],
      };
    }
  } catch (e) {
    return {
      status: "ERROR",
      errors: [
        {
          message: `${e}`,
        },
      ],
    };
  }
};

export const FindPublishedNewsArticles = async (
): Promise<ServerActionResponse<Array<NewsArticleModel>>> => {
  try {
    const querySpec: SqlQuerySpec = {
      query:
        "SELECT * FROM root r WHERE r.type=@type AND r.isPublished=@isPublished ORDER BY r.createdAt DESC",
      parameters: [
        {
          name: "@type",
          value: NEWS_ARTICLE,
        },
        {
          name: "@isPublished",
          value: true,
        }
      ],
    };

    const { resources } = await ConfigContainer()
      .items.query<NewsArticleModel>(querySpec)
      .fetchAll();

    if (resources) {
      return {
        status: "OK",
        response: resources,
      };
    } else {
      return {
        status: "ERROR",
        errors: [
          {
            message: "No news found",
          },
        ],
      };
    }
  } catch (e) {
    return {
      status: "ERROR",
      errors: [
        {
          message: `${e}`,
        },
      ],
    };
  }
};

export const EnsureArticleOperation = async (
  articleId: string
): Promise<ServerActionResponse<NewsArticleModel>> => {
  const articleResponse = await FindArticleByID(articleId);
  const currentUser = await getCurrentUser();

  if (articleResponse.status === "OK") {
    if (currentUser.isAdmin) {
      return articleResponse;
    }
  }

  return {
    status: "UNAUTHORIZED",
    errors: [
      {
        message: `Article not found with id: ${articleId}`,
      },
    ],
  };
};

export const DeleteArticle = async (
  articleId: string
): Promise<ServerActionResponse<NewsArticleModel>> => {
  try {
    const articleResponse = await EnsureArticleOperation(articleId);

    if (articleResponse.status === "OK") {
      const { resource: deletedArticle } = await ConfigContainer()
        .item(articleId)
        .delete();

      return {
        status: "OK",
        response: deletedArticle,
      };
    }

    return articleResponse;
  } catch (error) {
    return {
      status: "ERROR",
      errors: [
        {
          message: `Error deleting article: ${error}`,
        },
      ],
    };
  }
};

export const FindArticleByID = async (
  id: string
): Promise<ServerActionResponse<NewsArticleModel>> => {
  try {
    const querySpec: SqlQuerySpec = {
      query: "SELECT * FROM root r WHERE r.type=@type AND r.id=@id",
      parameters: [
        {
          name: "@type",
          value: NEWS_ARTICLE,
        },
        {
          name: "@id",
          value: id,
        },
      ],
    };

    const { resources } = await ConfigContainer()
      .items.query<NewsArticleModel>(querySpec)
      .fetchAll();

    if (resources.length === 0) {
      return {
        status: "NOT_FOUND",
        errors: [
          {
            message: "Article not found",
          },
        ],
      };
    }

    return {
      status: "OK",
      response: resources[0],
    };
  } catch (error) {
    return {
      status: "ERROR",
      errors: [
        {
          message: `Error finding article: ${error}`,
        },
      ],
    };
  }
};

export const UpsertArticle = async (
  articleInput: NewsArticleModel
): Promise<ServerActionResponse<NewsArticleModel>> => {
  try {
    const articleResponse = await EnsureArticleOperation(articleInput.id);

    if (articleResponse.status === "OK") {
      const { response: article } = articleResponse;
      const user = await getCurrentUser();

      const modelToUpdate: NewsArticleModel = {
        ...article,
        title: articleInput.title,
        description: articleInput.description,
        link: articleInput.link,
        isPublished: user.isAdmin
          ? articleInput.isPublished
          : article.isPublished,
        createdAt: new Date(),
      };

      const validationResponse = ValidateSchema(modelToUpdate);
      if (validationResponse.status !== "OK") {
        return validationResponse;
      }

      const { resource } = await ConfigContainer().items.upsert<NewsArticleModel>(
        modelToUpdate
      );

      if (resource) {
        return {
          status: "OK",
          response: resource,
        };
      }

      return {
        status: "ERROR",
        errors: [
          {
            message: "Error updating article",
          },
        ],
      };
    }

    return articleResponse;
  } catch (error) {
    return {
      status: "ERROR",
      errors: [
        {
          message: `Error updating article: ${error}`,
        },
      ],
    };
  }
};

const ValidateSchema = (model: NewsArticleModel): ServerActionResponse => {
  const validatedFields = NewsArticleModelSchema.safeParse(model);

  if (!validatedFields.success) {
    return {
      status: "ERROR",
      errors: zodErrorsToServerActionErrors(validatedFields.error.errors),
    };
  }

  return {
    status: "OK",
    response: model,
  };
};
