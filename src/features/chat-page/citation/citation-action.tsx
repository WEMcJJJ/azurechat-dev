"use server";

import { FindCitationByID } from "../chat-services/citation-service";

export interface CitationResult {
  status: "OK" | "ERROR";
  content?: any;
  errors?: Array<{ message: string }>;
}

export const CitationAction = async (
  previousState: any,
  formData: FormData
): Promise<CitationResult> => {
  const searchResponse = await FindCitationByID(formData.get("id") as string);

  if (searchResponse.status !== "OK") {
    return {
      status: "ERROR",
      errors: searchResponse.errors,
    };
  }

  return {
    status: "OK",
    content: searchResponse.response.content,
  };
};
