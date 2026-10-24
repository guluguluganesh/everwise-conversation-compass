import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Brain, Check, Copy, ThumbsDown } from "lucide-react";
import { toast } from "sonner";
import { authHeaders, loadMessages } from "@/lib/chat-api";
import { Composer } from "@/components/chat/Composer";
import { AtlasMark } from "@/components/chat/AtlasMark";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/chat/$id")({ component: ThreadPage });

function ThreadPage() {
  const { id } = Route.useParams();
  const { data, isLoading, error } = useQuery({ queryKey: ["messages", id], queryFn: () => loadMessages(id), staleTime: Infinity });
  if (error) return <div className="p-8 text-destructive">Could not load this chat.</div>;
  if (isLoading || !data) return <div className="flex flex-1 items-center justify-center text-muted-foreground">Loading…</div>;
  return <ChatWindow key={id} id={id} initial={data} />;
}

function textOf(m: UIMessage) {
  return m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
}

function ChatWindow({ id, initial }: { id: string; initial: UIMessage[] }) {
  const qc = useQueryClient();
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat", body: { conversationId: id }, headers: authHeaders }), [id]);
  const { messages, sendMessage, status, stop } = useChat({
    id,
    messages: initial,
    transport,
    onError: (e) => toast.error(e.message || "Something went wrong. Please try again."),
    onFinish: () => { qc.invalidateQueries({ queryKey: ["conversations"] }); qc.invalidateQueries({ queryKey: ["messages", id] }); },
  });
  const busy = status === "submitted" || status === "streaming";
  const bottom = useRef<HTMLDivElement>(null);
  const sentPending = useRef(false);

  useEffect(() => {
    if (sentPending.current) return;
    const key = `pending:${id}`;
    const p = sessionStorage.getItem(key);
    if (p) { sentPending.current = true; sessionStorage.removeItem(key); sendMessage({ text: p }); }
  }, [id, sendMessage]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, status]);

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 pb-8 pt-14">
          {messages.length === 0 && <p className="mt-20 text-center text-muted-foreground">Send a message to start.</p>}
          {messages.map((m, i) => (
            <MessageRow key={m.id} m={m} question={i > 0 ? textOf(messages[i - 1]) : ""} streaming={busy && i === messages.length - 1} />
          ))}
          {status === "submitted" && (
            <div className="flex gap-4 py-4"><AtlasMark className="h-7 w-7 shrink-0" /><div className="flex items-center gap-1 pt-2">{[0, 1, 2].map((d) => <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: `${d * 150}ms` }} />)}</div></div>
          )}
          <div ref={bottom} />
        </div>
      </div>
      <div className="mx-auto w-full max-w-3xl px-4 pb-4">
        <Composer onSend={(t) => sendMessage({ text: t })} busy={busy} onStop={stop} />
        <p className="mt-2 text-center text-xs text-muted-foreground">Atlas remembers mistakes you flag and never repeats them.</p>
      </div>
    </>
  );
}

function MessageRow({ m, question, streaming }: { m: UIMessage; question: string; streaming: boolean }) {
  const [copied, setCopied] = useState(false);
  const [flagOpen, setFlagOpen] = useState(false);
  const text = textOf(m);
  if (m.role === "user") {
    return (
      <div className="flex justify-end py-3">
        <div className="max-w-[80%] whitespace-pre-wrap rounded-3xl bg-bubble px-5 py-2.5 text-bubble-foreground">{text}</div>
      </div>
    );
  }
  const reasoning = m.parts.filter((p) => p.type === "reasoning").map((p) => (p as { text: string }).text).join("\n").trim();
  const savedMemory = m.parts.some((p) => p.type === "tool-save_memory");
  return (
    <div className="group flex gap-4 py-4">
      <AtlasMark className="h-7 w-7 shrink-0" />
      <div className="min-w-0 flex-1">
        {reasoning && (
          <details className="mb-2 text-sm text-muted-foreground">
            <summary className="cursor-pointer select-none">Thinking</summary>
            <div className="mt-1 whitespace-pre-wrap border-l border-border pl-3">{reasoning}</div>
          </details>
        )}
        <div className="prose-chat"><ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown></div>
        {savedMemory && <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"><Brain className="h-3 w-3" /> Memory updated</div>}
        {!streaming && text && (
          <div className="mt-2 flex gap-1 opacity-60 transition-opacity group-hover:opacity-100">
            <button aria-label="Copy" onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="rounded-md p-1.5 hover:bg-accent">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
            <button aria-label="This was wrong" title="This was wrong — teach Atlas" onClick={() => setFlagOpen(true)} className="rounded-md p-1.5 hover:bg-accent">
              <ThumbsDown className="h-4 w-4" />
            </button>
          </div>
        )}
        <FlagDialog open={flagOpen} onOpenChange={setFlagOpen} question={question} answer={text} />
      </div>
    </div>
  );
}

function FlagDialog({ open, onOpenChange, question, answer }: { open: boolean; onOpenChange: (o: boolean) => void; question: string; answer: string }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    try {
      const res = await fetch("/api/flag", { method: "POST", headers: { "content-type": "application/json", ...(await authHeaders()) }, body: JSON.stringify({ question, answer, note }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Could not save");
      toast.success("Saved. Atlas will not repeat this mistake.", { description: j.lesson });
      setNote(""); onOpenChange(false);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>What was wrong?</DialogTitle></DialogHeader>
        <Textarea rows={4} placeholder="e.g. The code throws because the array is mutated while iterating…" value={note} onChange={(e) => setNote(e.target.value)} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save mistake"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
