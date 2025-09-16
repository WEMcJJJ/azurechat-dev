import Markdoc from "@markdoc/markdoc";
import React, { FC, isValidElement, useState } from "react";
import { Citation } from "./citation";
import { CodeBlock } from "./code-block";
import { citationConfig } from "./config";
import { MarkdownProvider } from "./markdown-context";
import { Paragraph } from "./paragraph";

interface Props {
  content: string;
  onCitationClick: (
    previousState: any,
    formData: FormData
  ) => Promise<JSX.Element>;
}

export const Markdown: FC<Props> = (props) => {
  const ast = Markdoc.parse(props.content);

  const content = Markdoc.transform(ast, {
    ...citationConfig,
  });

  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const rendered = Markdoc.renderers.react(content, React, {
    components: { Citation, Paragraph, CodeBlock },
  });

  // Recursively wrap any <img> with an anchor linking to the same src (opens in new tab)
  const wrapImages = (node: any): any => {
    if (Array.isArray(node)) return node.map(wrapImages);
    if (!isValidElement(node)) return node;
    const propsAny: any = node.props || {};
    if (node.type === 'img' && propsAny.src) {
      const imgEl: any = node;
      const mergedClass = ((propsAny.className as string) || '') + ' cursor-pointer transition shadow-sm hover:shadow-lg';
      return (
        <button
          type="button"
          onClick={() => setLightboxSrc(propsAny.src)}
          className="inline-block group focus:outline-none"
          title="Click to view full size"
        >
          {React.cloneElement(imgEl, { ...(propsAny as any), className: mergedClass })}
        </button>
      );
    }
    // Clone element and process its children
    if (propsAny.children) {
      return React.cloneElement(node, { ...propsAny, children: wrapImages(propsAny.children) });
    }
    return node;
  };

  const wrapped = wrapImages(rendered);

  const WithContext = () => (
    <MarkdownProvider onCitationClick={props.onCitationClick}>
      {wrapped}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          aria-modal="true"
          role="dialog"
          onClick={() => setLightboxSrc(null)}
        >
          <div className="relative max-h-full max-w-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightboxSrc}
              alt="Full size"
              className="max-h-[90vh] max-w-[90vw] object-contain rounded shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setLightboxSrc(null)}
              className="absolute -top-3 -right-3 bg-white/90 text-black rounded-full w-8 h-8 flex items-center justify-center text-lg shadow hover:bg-white"
              aria-label="Close"
            >
              ×
            </button>
            <div className="mt-2 flex gap-3 justify-center">
              <a
                href={lightboxSrc}
                download
                className="text-xs text-white/80 underline hover:text-white"
              >
                Download
              </a>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(lightboxSrc).catch(()=>{});
                }}
                className="text-xs text-white/80 underline hover:text-white"
              >
                Copy URL
              </button>
              <button
                type="button"
                onClick={() => window.open(lightboxSrc, '_blank', 'noopener')}
                className="text-xs text-white/80 underline hover:text-white"
              >
                Open in new tab
              </button>
            </div>
          </div>
        </div>
      )}
    </MarkdownProvider>
  );

  return <WithContext />;
};
