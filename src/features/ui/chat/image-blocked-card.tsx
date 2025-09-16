import React from 'react';
import { Card } from '../card';
import { Markdown } from '../markdown/markdown';

const noopCitation = async () => (<></>);

export interface ImageBlockedCardProps {
  markdown: string;
  source: string;
  blockedCategories?: string[];
}

export const ImageBlockedCard: React.FC<ImageBlockedCardProps> = ({ markdown, source, blockedCategories }) => {
  return (
    <Card className="p-4 border-destructive/40 bg-destructive/5 space-y-3 text-sm">
      <div className="font-semibold flex items-center gap-2">
        <span>🚫 Image Request Blocked</span>
        <span className="text-xs rounded bg-muted px-2 py-0.5 uppercase tracking-wide">{source}</span>
      </div>
      {blockedCategories && blockedCategories.length > 0 && (
        <div className="text-xs text-muted-foreground">
          Categories: {blockedCategories.join(', ')}
        </div>
      )}
  <Markdown content={markdown} onCitationClick={noopCitation} />
    </Card>
  );
};
