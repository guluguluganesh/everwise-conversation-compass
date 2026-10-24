import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createConversation } from "@/lib/chat-api";
import { Composer } from "@/components/chat/Composer";
import { AtlasMark } from "@/components/chat/AtlasMark";

export const Route = createFileRoute("/_authenticated/chat/")({ component: NewChat });

function NewChat() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  async function start(text: string) {
    try {
      const id = await createConversation();
      sessionStorage.setItem(`pending:${id}`, text);
      await qc.invalidateQueries({ queryKey: ["conversations"] });
      navigate({ to: "/chat/$id", params: { id } });
    } catch (e) { toast.error((e as Error).message); }
  }
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4">
      <AtlasMark className="mb-4 h-10 w-10" />
      <h1 className="mb-8 text-3xl font-medium">How can I help you today?</h1>
      <div className="w-full max-w-3xl"><Composer onSend={start} busy={false} /></div>
    </div>
  );
}
