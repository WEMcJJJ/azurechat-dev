import { Send } from "lucide-react";
import React from "react";
import { Button } from "../../button";

interface SubmitChatProps extends React.HTMLAttributes<HTMLButtonElement> {
  disabled?: boolean;
}

export const SubmitChat = React.forwardRef<
  HTMLButtonElement,
  SubmitChatProps
>(({ disabled, ...props }, ref) => (
  <Button 
    size="icon" 
    type="submit" 
    variant={"ghost"} 
    disabled={disabled}
    {...props} 
    ref={ref} 
    aria-label="Submit chat input"
  >
    <Send size={16} />
  </Button>
));
SubmitChat.displayName = "SubmitChat";
