'use client';

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
import { useSession } from "next-auth/react";

interface ChatPersonaProps {
  personas: PersonaModel[];
  extensions: ExtensionModel[];
}

export const ChatHome: FC<ChatPersonaProps> = (props) => {
  const { data: session } = useSession();
  const isAdmin = session?.user?.isAdmin;

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
            <h2 className="text-2xl font-bold mb-3">Welcome to WestEd Chat</h2>
            <p className="text-muted-foreground max-w-xl">Click the '+ New Chat' button in the top left to start a new chat.</p>
            <br></br>
            <p className="text-muted-foreground max-w-xl">If you don't see the '+ New Chat' button, you might have to toggle the menu by clicking the following icon in the top left of the menu bar (or the one below):</p>
            <MenuTrayToggle />
            <br></br>
            <p className="text-muted-foreground max-w-xl">For additional information about how to use WestEd Chat, see the <a target="_blank" className="underline text-blue-600 hover:text-blue-800 visited:text-purple-600" href="https://westedintranet--simpplr.vf.force.com/apex/simpplr__app?u=/site/a076T00001hzhWtQAI/page/a01VO000005h6YjYAI">WestEd AI article</a> on Inside WestEd.</p>
            <br></br>
            <p className="text-muted-foreground max-w-xl">To learn more about AI at WestEd, visit the <a target="_blank" className="underline text-blue-600 hover:text-blue-800 visited:text-purple-600" href="https://westedintranet--simpplr.vf.force.com/apex/simpplr__app?u=/site/a076T00001hzhWtQAI/dashboard">AI Hub</a> on Inside WestEd.</p>
          </div>

          {session?.user?.isAdmin && (
            <>
            <h2 className="text-2xl font-bold mb-3">Welcome Admin</h2><div>
              <h2 className="text-2xl font-bold mb-3">Extensions</h2>

              {props.extensions && props.extensions.length > 0 ? (
                <div className="grid grid-cols-3 gap-3">
                  {props.extensions.map((extension) => {
                    return (
                      <ExtensionCard
                        extension={extension}
                        key={extension.id}
                        showContextMenu={false} />
                    );
                  })}
                </div>
              ) :
                <p className="text-muted-foreground max-w-xl">No extentions created</p>}

            </div>
              </>
          )}
          <div>
              <h2 className="text-2xl font-bold mb-3">Personas</h2>

              {props.personas && props.personas.length > 0 ? (
                <div className="grid grid-cols-3 gap-3">
                  {props.personas.map((persona) => {
                    return (
                      <PersonaCard
                        persona={persona}
                        key={persona.id}
                        showContextMenu={false} />
                    );
                  })}
                </div>
              ) :
                <p className="text-muted-foreground max-w-xl">No personas created</p>}
            </div>

        </div>
        <AddExtension />
      </main>
    </ScrollArea>
  );
};
