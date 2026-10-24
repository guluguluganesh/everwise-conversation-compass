import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Atlas — AI assistant that learns from its mistakes" },
      { name: "description", content: "Chat with Atlas, an AI assistant that remembers its mistakes and your preferences." },
      { property: "og:title", content: "Atlas — AI assistant that learns" },
      { property: "og:description", content: "Chat with an AI that never repeats the same mistake." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    throw redirect({ to: data.session ? "/chat" : "/auth" });
  },
  component: () => null,
});
