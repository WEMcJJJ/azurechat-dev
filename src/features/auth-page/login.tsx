"use client";
import { AI_NAME } from "@/features/theme/theme-config";
import { signIn } from "next-auth/react";
import { FC } from "react";
import { AiLogo } from "@/features/ui/ai-logo";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";

interface LoginProps {
  isDevMode: boolean;
}

export const LogIn: FC<LoginProps> = (props) => {
  return (
    <Card className="flex gap-2 flex-col min-w-[300px]">
      <CardHeader className="gap-2">
        <CardTitle className="text-2xl flex gap-2 items-center">
          <AiLogo height={32} />
          <span className="text-primary">{AI_NAME}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {/* <Button onClick={() => signIn("okta")}> Okta</Button>--> */}
        <Button onClick={() => signIn("azure-ad")}> Log in</Button>
        {props.isDevMode ? (
            <><Button onClick={() => signIn("localdev")}>
            Basic Auth (DEV ONLY)
          </Button></>
        ) : null}
      </CardContent>
    </Card>
  );
};
