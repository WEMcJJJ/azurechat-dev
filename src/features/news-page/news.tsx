import { AI_NAME } from "@/features/theme/theme-config";
import { Book } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { NewsArticleModel } from "./news-model";

export const News = (props: {
  selectedArticle: (e: string) => void;
  sampleNews: Array<NewsArticleModel>;
}) => {
  const [open, setOpen] = useState(false);

  function onArticleClicked(item: NewsArticleModel): void {
    setOpen(false);
    return props.selectedArticle(item.description);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen} modal={false}>
      <DialogTrigger asChild>
        <Button size="icon" type="button" variant={"ghost"}>
          <Book size={16} />
        </Button>
      </DialogTrigger>
      <DialogContent className="min-w-[300px] md:h-[800px] md:min-w-[800px] lg:h-[800px] lg:min-w-[800px] ">
        <DialogHeader>
          <DialogTitle>
            <h1 className="text-2xl font-bold mb-4">{AI_NAME}</h1>
          </DialogTitle>
          <div className="max-h-[600px] m-auto overflow-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {props.sampleNews.map((item, index) => (
              <Card
                key={index}
                onClick={() => onArticleClicked(item)}
                className="flex flex-col h-[250px] hover:bg-secondary/80"
              >
                <CardHeader className="gap-2">
                  <CardTitle className="text-2xl flex gap-2">
                    {item.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-grow overflow-auto">
                  {item.description}
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
};
