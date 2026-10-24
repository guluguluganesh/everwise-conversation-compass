import { createFileRoute } from "@tanstack/react-router";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { authFromRequest } from "@/server/auth.server";
import { saveMemory } from "@/server/memory.server";

export const Route = createFileRoute("/api/flag")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authFromRequest(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });
        const { question, answer, note } = (await request.json()) as { question: string; answer: string; note: string };
        if (!answer) return new Response("Bad request", { status: 400 });

        let lesson = note?.trim() || "";
        try {
          const apiKey = process.env['LOVABLE_API_KEY']!;
          const provider = createOpenAI({
            baseURL: "https://ai.gateway.lovable.dev/v1",
            apiKey,
            headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
          });
          const r = streamText({
            model: provider.responses("openai/gpt-6-astra"),
            instructions: "An AI assistant gave a wrong answer. Write ONE concise, general rule (max 2 sentences) the assistant must follow in future to never repeat this mistake. Output only the rule.",
            prompt: `User question:\n${question.slice(0, 4000)}\n\nWrong answer:\n${answer.slice(0, 6000)}\n\nUser's explanation of what was wrong:\n${note || "(none)"}`,
            providerOptions: { openai: { store: false, forceReasoning: true, reasoningEffort: "low" } },
          });
          const t = (await r.text).trim();
          if (t) lesson = t;
        } catch (e) {
          console.error("lesson summary failed", e);
        }
        if (!lesson) lesson = `Avoid the answer pattern given for: "${question.slice(0, 200)}"`;
        try {
          await saveMemory({ userId: auth.userId, type: "mistake", content: lesson, context: question.slice(0, 500) });
        } catch (e) {
          console.error(e);
          return Response.json({ error: "Could not save to memory database" }, { status: 500 });
        }
        return Response.json({ lesson });
      },
    },
  },
});
