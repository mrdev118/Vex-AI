import { formatDistanceToNow } from "date-fns";
import { Message } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface MessageListProps {
  messages?: Message[];
  isLoading: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-6 rounded-lg border border-neutral-100 bg-white space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-20 mt-4" />
          </div>
        ))}
      </div>
    );
  }

  if (!messages?.length) {
    return (
      <div className="text-center py-20 text-neutral-400 bg-white rounded-lg border border-dashed border-neutral-200">
        <p>No messages yet. Be the first to say something!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {messages.map((message, index) => (
        <Card 
          key={message.id} 
          className="border-neutral-100 hover:border-neutral-200 hover:shadow-md transition-all duration-300 animate-in-up"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <CardContent className="p-6">
            <p className="text-neutral-800 leading-relaxed whitespace-pre-wrap font-light">
              {message.content}
            </p>
            <div className="mt-4 flex items-center justify-end">
              <span className="text-xs font-medium text-neutral-300 uppercase tracking-wide">
                {message.createdAt && formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
