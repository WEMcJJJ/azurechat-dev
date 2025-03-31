"use client";
import { useSession } from "next-auth/react";
import { Button } from "@/features/ui/button";
import { Pencil } from "lucide-react";
import { FC } from "react";
import { Card, CardContent, CardHeader, CardFooter, CardTitle } from "../ui/card";
import { PromptModel } from "./models";
import { promptStore } from "./prompt-store";
import { PromptCardContextMenu } from "./prompt-card-context-menu";

interface Props {
  prompt: PromptModel;
  showContextMenu: boolean;
}

export const PromptCard: FC<Props> = (props) => {
  const { prompt } = props;

  const { data } = useSession();

  return (
    <Card key={prompt.id} className="flex flex-col">
      <CardHeader className="flex flex-row">
        <CardTitle className="flex-1">{prompt.name}</CardTitle>
        {props.showContextMenu && (
          <div>
            <PromptCardContextMenu prompt={prompt} />
          </div>
        )}
      </CardHeader>
      <CardContent className="text-muted-foreground flex-1">
        { data?.user?.isAdmin && (
          prompt.isPublished
          ? <><div className="text-green-500 w-full flex justify-left">Published</div><br></br></>
          : <><div className="text-red-500 w-full flex justify-left">Unpublished</div><br></br></>)
        }
        {prompt.description.length > 100
          ? prompt.description.slice(0, 100).concat("...")
          : prompt.description}
      </CardContent>
      <CardFooter className="gap-1 content-stretch f">
        {props.showContextMenu && (
          <Button
            variant={"outline"}
            title="Show message"
            onClick={() => promptStore.updatePrompt(props.prompt)}
          >
            <Pencil size={18} />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};
