"use client";

import { Button } from "@/features/ui/button";
import { Pencil } from "lucide-react";
import { FC } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../ui/card";
import { ExtensionModel } from "../extension-services/models";
import { extensionStore } from "../extension-store";
import { ExtensionCardContextMenu } from "./extension-context-menu";
import { StartNewExtensionChat } from "./start-new-extension-chat";

interface Props {
  extension: ExtensionModel;
  showActionMenu: boolean
}

export const ExtensionCard: FC<Props> = (props) => {
  const { extension } = props;
  return (
    <Card key={extension.id} className="flex flex-col">
      <CardHeader className="flex flex-row">
        <CardTitle className="flex-1">{extension.name}</CardTitle>
        {props.showActionMenu && (
          <div>
            <ExtensionCardContextMenu extension={extension} />
          </div>
        )}
      </CardHeader>
      <CardContent className="text-muted-foreground flex-1">
        {extension.isPublished
          ? <div className="text-green-500 w-full flex justify-left">Published</div>
          : <div className="text-red-500 w-full flex justify-left">Unpublished</div>
        }<br></br>
        {extension.description}
      </CardContent>
      <CardFooter className="gap-1 content-stretch f">
        {props.showActionMenu && (
          <Button
            variant={"outline"}
            title="Show message"
            onClick={() => extensionStore.openAndUpdate(props.extension)}
          >
            <Pencil size={18} />
          </Button>
        )}

        <StartNewExtensionChat extension={extension} />
      </CardFooter>
    </Card>
  );
};
