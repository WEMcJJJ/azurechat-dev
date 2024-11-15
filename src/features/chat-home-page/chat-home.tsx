import { AddExtension } from "@/features/extensions-page/add-extension/add-new-extension";
import { ExtensionCard } from "@/features/extensions-page/extension-card/extension-card";
import { ExtensionModel } from "@/features/extensions-page/extension-services/models";
import { PersonaCard } from "@/features/persona-page/persona-card/persona-card";
import { PersonaModel } from "@/features/persona-page/persona-services/models";
import { AI_DESCRIPTION, AI_NAME } from "@/features/theme/theme-config";
import { Hero } from "@/features/ui/hero";
import { ScrollArea } from "@/features/ui/scroll-area";
import Image from "next/image";
import { FC } from "react";
import { MenuTrayToggle } from "@/features/main-menu/menu-tray-toggle";

interface ChatPersonaProps {
  personas: PersonaModel[];
  extensions: ExtensionModel[];
}

export const ChatHome: FC<ChatPersonaProps> = (props) => {
  return (
    <ScrollArea className="flex-1 pl-5 pr-5">
      <main className="flex flex-1 flex-col gap-6 pb-6">
        <Hero
          title={
            <>
              <Image
                src={"/ai-icon.png"}
                width={60}
                height={60}
                quality={100}
                alt="ai-icon"
              />{" "}
              {AI_NAME}
            </>
          }
          description={AI_DESCRIPTION}
        ></Hero>
        <div className="container max-w-4xl flex gap-20 flex-col">
          <div>
            <h2 className="text-2xl font-bold mb-3">Welcome to WestEd Secure AI</h2>
            <p className="text-muted-foreground max-w-xl">Click the '+ New Chat' button in the top left to start a new chat.</p>
            <br></br>
            <p className="text-muted-foreground max-w-xl">If you don't see the '+ New Chat' button, you might have to toggle the menu by clicking the following icon in the top left of the menu bar (or the one below):</p>
            <MenuTrayToggle />
          </div>
        </div>
        <AddExtension />
      </main>
    </ScrollArea>
  );
};
