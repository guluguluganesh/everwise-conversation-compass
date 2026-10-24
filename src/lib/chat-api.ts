import { supabase } from "@/integrations/supabase/client";
import type { UIMessage } from "ai";

export async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}

export async function listConversations() {
  const { data, error } = await supabase.from("conversations").select("id,title,updated_at").order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createConversation() {
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("conversations").insert({ user_id: u.user!.id }).select("id").single();
  if (error) throw error;
  return data.id;
}

export async function loadMessages(conversationId: string): Promise<UIMessage[]> {
  const { data, error } = await supabase.from("messages").select("message_id,role,parts").eq("conversation_id", conversationId).order("created_at");
  if (error) throw error;
  return data.map((m) => ({ id: m.message_id, role: m.role as UIMessage["role"], parts: m.parts as UIMessage["parts"] }));
}
