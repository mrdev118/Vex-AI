import { Layout } from "@/components/layout";
import { MessageForm } from "@/components/message-form";
import { MessageList } from "@/components/message-list";
import { useMessages } from "@/hooks/use-messages";
import { MessageSquare } from "lucide-react";

export default function Home() {
  const { data: messages, isLoading } = useMessages();
  
  // Sort messages by creation time (newest first)
  // Assuming ID increments with time, otherwise we'd parse dates
  const sortedMessages = messages?.slice().sort((a, b) => b.id - a.id);

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-10 text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 rounded-full bg-white shadow-sm border border-neutral-100 mb-4">
            <MessageSquare className="w-5 h-5 text-neutral-900" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
            Community Board
          </h2>
          <p className="text-neutral-500 max-w-sm mx-auto">
            A minimal space to share thoughts, ideas, and messages with the world.
          </p>
        </div>

        <MessageForm />
        
        <div className="relative">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-neutral-200" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-neutral-50 px-3 text-sm text-neutral-400 font-medium uppercase tracking-widest">
              Recent Activity
            </span>
          </div>
        </div>
        
        <div className="mt-10">
          <MessageList messages={sortedMessages} isLoading={isLoading} />
        </div>
      </div>
    </Layout>
  );
}
