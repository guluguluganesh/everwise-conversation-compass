import { createFileRoute, Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { LogOut, Menu, PanelLeftClose, SquarePen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createConversation, listConversations } from "@/lib/chat-api";
import { AtlasMark } from "@/components/chat/AtlasMark";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({ meta: [{ title: "Atlas" }, { name: "description", content: "Chat with Atlas." }, { property: "og:title", content: "Atlas" }, { property: "og:description", content: "Chat with Atlas." }] }),
  component: ChatLayout,
});

function ChatLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const params = useParams({ strict: false }) as { id?: string };
  const [open, setOpen] = useState(true);
  const { data: convs = [] } = useQuery({ queryKey: ["conversations"], queryFn: listConversations });

  async function newChat() {
    try {
      const id = await createConversation();
      await qc.invalidateQueries({ queryKey: ["conversations"] });
      navigate({ to: "/chat/$id", params: { id } });
    } catch (e) { toast.error((e as Error).message); }
  }

  async function del(id: string) {
    const { error } = await supabase.from("conversations").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["conversations"] });
    if (params.id === id) navigate({ to: "/chat" });
    return;
  }

  async function signOut() {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {open && (
        <aside className="flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
          <div className="flex items-center justify-between p-3">
            <Link to="/chat" className="flex items-center gap-2 font-semibold"><AtlasMark /> Atlas</Link>
            <button aria-label="Close sidebar" onClick={() => setOpen(false)} className="rounded-md p-1.5 hover:bg-sidebar-accent"><PanelLeftClose className="h-4 w-4" /></button>
          </div>
          <div className="px-3">
            <button onClick={newChat} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-sidebar-accent">
              <SquarePen className="h-4 w-4" /> New chat
            </button>
          </div>
          <div className="mt-4 px-5 text-xs font-medium text-muted-foreground">Chats</div>
          <nav className="mt-1 flex-1 overflow-y-auto px-3 pb-3">
            {convs.map((c) => (
              <div key={c.id} className={`group flex items-center rounded-lg text-sm hover:bg-sidebar-accent ${params.id === c.id ? "bg-sidebar-accent" : ""}`}>
                <Link to="/chat/$id" params={{ id: c.id }} className="flex-1 truncate px-3 py-2">{c.title}</Link>
                <button aria-label="Delete chat" onClick={() => del(c.id)} className="mr-1 hidden rounded p-1 text-muted-foreground hover:text-destructive group-hover:block"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
            {convs.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">No chats yet</p>}
          </nav>
          <div className="flex items-center justify-between border-t border-sidebar-border p-3 text-sm">
            <span className="truncate text-muted-foreground">{user.email}</span>
            <button aria-label="Sign out" onClick={signOut} className="rounded-md p-1.5 hover:bg-sidebar-accent"><LogOut className="h-4 w-4" /></button>
          </div>
        </aside>
      )}
      <main className="relative flex min-w-0 flex-1 flex-col">
        {!open && (
          <div className="absolute left-3 top-3 z-10 flex gap-1">
            <button aria-label="Open sidebar" onClick={() => setOpen(true)} className="rounded-md p-2 hover:bg-accent"><Menu className="h-4 w-4" /></button>
            <button aria-label="New chat" onClick={newChat} className="rounded-md p-2 hover:bg-accent"><SquarePen className="h-4 w-4" /></button>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
