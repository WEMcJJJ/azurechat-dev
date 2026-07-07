import { FC, PropsWithChildren, createContext, useContext } from "react";
import { CitationResult } from "@/features/chat-page/citation/citation-action";

interface ContextProps {
  onCitationClick?: (
    previousState: any,
    formData: FormData
  ) => Promise<CitationResult>;
}

const Context = createContext<ContextProps | null>(null);

interface ProviderProps extends PropsWithChildren {
  onCitationClick: (
    previousState: any,
    formData: FormData
  ) => Promise<CitationResult>;
}

export const MarkdownProvider: FC<ProviderProps> = (props: ProviderProps) => {
  const { onCitationClick } = props;
  return (
    <Context.Provider
      value={{
        onCitationClick,
      }}
    >
      {props.children}
    </Context.Provider>
  );
};

export const useMarkdownContext = () => {
  const context = useContext(Context);
  if (!context) {
    throw new Error("Markdown Context is null");
  }

  return context;
};
