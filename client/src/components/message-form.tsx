import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertMessageSchema } from "@shared/schema";
import { useCreateMessage } from "@/hooks/use-messages";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Send } from "lucide-react";
import type { MessageInput } from "@shared/routes";

export function MessageForm() {
  const { mutate, isPending } = useCreateMessage();
  const [charCount, setCharCount] = useState(0);

  const form = useForm<MessageInput>({
    resolver: zodResolver(insertMessageSchema),
    defaultValues: {
      content: "",
    },
  });

  const onSubmit = (data: MessageInput) => {
    mutate(data, {
      onSuccess: () => {
        form.reset();
        setCharCount(0);
      },
    });
  };

  return (
    <Card className="border-none shadow-lg shadow-neutral-200/50 mb-12 overflow-hidden bg-white">
      <CardContent className="p-0">
        <form onSubmit={form.handleSubmit(onSubmit)} className="relative">
          <Textarea
            {...form.register("content", {
              onChange: (e) => setCharCount(e.target.value.length),
            })}
            placeholder="Share your thoughts..."
            className="min-h-[140px] resize-none border-none focus-visible:ring-0 p-6 text-base placeholder:text-neutral-300"
            disabled={isPending}
          />
          <div className="flex justify-between items-center p-4 bg-neutral-50/50 border-t border-neutral-100">
            <span className="text-xs text-neutral-400 font-medium">
              {charCount} characters
            </span>
            <Button 
              type="submit" 
              disabled={isPending || charCount === 0}
              className="px-6 rounded-full transition-all duration-300 shadow-md hover:shadow-lg disabled:opacity-50 disabled:shadow-none"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Posting...
                </>
              ) : (
                <>
                  Post Message
                  <Send className="ml-2 h-3 w-3" />
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
