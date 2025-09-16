"use client";
import { cn } from "@/ui/lib";
import {
  CheckIcon,
  ClipboardIcon,
  PocketKnife,
  UserCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Avatar, AvatarImage } from "../../avatar";
import { Button } from "../../button";

export const ChatMessageArea = (props: {
  children?: React.ReactNode;
  profilePicture?: string | null;
  profileName?: string;
  role: "function" | "user" | "assistant" | "system" | "tool";
  onCopy: () => void;
  modelId?: string; // Keep for backward compatibility
  modelName?: string; // Direct model friendly name from database
}) => {
  const [isIconChecked, setIsIconChecked] = useState(false);

  // For legacy messages without stored model name, fetch it asynchronously
  const [legacyModelName, setLegacyModelName] = useState<string>("");

  // Only fetch model name for old messages that don't have it stored in database
  useEffect(() => {
    if (props.role === "assistant" && props.modelId && !props.modelName) {
      import("@/server/services/aoaiClientFactory").then(({ getModelConfigForThread }) => {
        getModelConfigForThread(props.modelId!).then((config) => {
          if (config?.friendlyName) {
            setLegacyModelName(config.friendlyName);
          }
        }).catch((error) => {
          console.warn("Failed to fetch model config for legacy message:", error);
        });
      });
    }
  }, [props.role, props.modelId, props.modelName]);

  const handleButtonClick = () => {
    props.onCopy();
    setIsIconChecked(true);
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsIconChecked(false);
    }, 2000);

    return () => clearTimeout(timeout);
  }, [isIconChecked]);

  let profile = null;

  switch (props.role) {
    case "user":
      if (props.profilePicture) {
        profile = (
          <Avatar className="rounded">
            <AvatarImage src={props.profilePicture} />
          </Avatar>
        );
      } else {
        profile = (
          <UserCircle
            size={28}
            strokeWidth={1.4}
            className="text-muted-foreground"
          />
        );
      }
      break;
    case "function":
      profile = (
        <PocketKnife
          size={28}
          strokeWidth={1.4}
          className="text-muted-foreground"
        />
      );
      break;
    default:
      profile = (
        <Avatar>
          <AvatarImage src="/ai-icon.png" />
        </Avatar>
      );
      break;
  }

  return (
    <div className="flex flex-col">
      <div className="h-7 flex items-center justify-between">
        <div className="flex gap-3">
          {profile}
          <div
            className={cn(
              "text-primary capitalize items-center flex",
              props.role === "function" || props.role === "tool"
                ? "text-muted-foreground text-sm"
                : ""
            )}
          >
            {props.profileName}
          </div>
        </div>
        <div className=" h-7 flex items-center justify-between gap-2">
          {/* Show model name for assistant messages */}
          {props.role === "assistant" && (props.modelName || legacyModelName) && (
            <div className="text-xs text-muted-foreground px-2 py-1 bg-muted/50 rounded-md">
              {props.modelName || legacyModelName}
            </div>
          )}
          <div>
            <Button
              variant={"ghost"}
              size={"sm"}
              title="Copy text"
              className="justify-right flex"
              onClick={handleButtonClick}
            >
              {isIconChecked ? (
                <CheckIcon size={16} />
              ) : (
                <ClipboardIcon size={16} />
              )}
            </Button>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2 flex-1 px-10">
        <div className="prose prose-slate dark:prose-invert whitespace-break-spaces prose-p:leading-relaxed prose-pre:p-0 max-w-none">
          {props.children}
        </div>
      </div>
    </div>
  );
};
