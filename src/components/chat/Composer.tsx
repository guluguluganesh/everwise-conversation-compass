import { useEffect, useRef, useState } from "react";
import { ArrowUp, Square } from "lucide-react";

export function Composer({ onSend, busy, onStop }: { onSend: (t: string) => void; busy: boolean; onStop?: () => void }) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.focus(); }, [busy]);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 240) + "px";
  }, [text]);

  function send() {
    const t = text.trim();
    if (!t || busy) return;
    onSend(t);
    setText("");
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); send(); }}
      className="flex items-end gap-2 rounded-3xl border border-input bg-card px-4 py-3 shadow-lg focus-within:border-ring"
    >
      <textarea
        ref={ref}
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
        placeholder="Message Atlas…"
        className="max-h-60 flex-1 resize-none bg-transparent py-1.5 text-[0.975rem] outline-none placeholder:text-muted-foreground"
      />
      {busy ? (
        <button type="button" aria-label="Stop" onClick={onStop} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
          <Square className="h-3.5 w-3.5 fill-current" />
        </button>
      ) : (
        <button type="submit" aria-label="Send" disabled={!text.trim()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-30">
          <ArrowUp className="h-4 w-4" />
        </button>
      )}
    </form>
  );
}
