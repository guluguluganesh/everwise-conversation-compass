import { createFileRoute } from "@tanstack/react-router";
import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, generateId, stepCountIs, streamText, tool, type LanguageModel, type UIMessage } from "ai";
import { z } from "zod";
import { authFromRequest } from "@/server/auth.server";
import { loadMemories, memoriesToPrompt, saveMemory } from "@/server/memory.server";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "@/server/run-id";

const BASE = `You are Atlas, a helpful, precise AI assistant similar to ChatGPT or Claude. Format answers in clean Markdown; use fenced code blocks with language tags for code.
Before answering coding or problem-solving questions, review the "PAST MISTAKES" list in your memory and make sure your answer does not repeat any of them.
When the user reveals a lasting preference, coding style (language, naming, formatting, frameworks), or important fact about themselves, call the save_memory tool silently. If you notice YOU made an error earlier in the conversation, correct it and call save_memory with type "mistake" describing the error and the correct approach as a general rule.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authFromRequest(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });
        const { supabase, userId } = auth;
        const body = (await request.json()) as { messages: UIMessage[]; conversationId: string };
        const { messages, conversationId } = body;
        if (!conversationId || !Array.isArray(messages)) return new Response("Bad request", { status: 400 });

        const { data: conv } = await supabase.from("conversations").select("id,title").eq("id", conversationId).maybeSingle();
        if (!conv) return new Response("Conversation not found", { status: 404 });

        // persist latest user message
        const last = messages[messages.length - 1];
        if (last?.role === "user") {
          const { error } = await supabase.from("messages").insert({
            conversation_id: conversationId, user_id: userId, message_id: last.id, role: "user", parts: last.parts as never,
          });
          if (error) console.error("save user msg", error);
          if (conv.title === "New chat") {
            const text = last.parts.map((p) => (p.type === "text" ? p.text : "")).join(" ").trim();
            await supabase.from("conversations").update({ title: text.slice(0, 60) || "New chat", updated_at: new Date().toISOString() }).eq("id", conversationId);
          } else {
            await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
          }
        }

        const memories = await loadMemories(userId);
        const apiKey = process.env['LOVABLE_API_KEY']!;
        const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
        const provider = createOpenAI({
          baseURL: "https://ai.gateway.lovable.dev/v1",
          apiKey,
          headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
          fetch: runIdFetch.fetch,
        });

        const result = streamText({
          model: provider.responses("openai/gpt-6-astra") as unknown as LanguageModel,
          instructions: BASE + memoriesToPrompt(memories),
          messages: await convertToModelMessages(messages),
          abortSignal: request.signal,
          stopWhen: stepCountIs(4),
          tools: {
            save_memory: tool({
              description: "Save a long-term memory about the user or a mistake you made, so it is applied in all future conversations.",
              inputSchema: z.object({
                type: z.enum(["mistake", "preference", "coding_style", "fact"]),
                content: z.string().describe("A concise, general rule or fact."),
              }),
              execute: async ({ type, content }) => {
                try {
                  await saveMemory({ userId, type, content });
                  return { saved: true };
                } catch (e) {
                  console.error("save memory", e);
                  return { saved: false };
                }
              },
            }),
          },
          providerOptions: {
            openai: {
              store: false,
              forceReasoning: true,
              reasoningEffort: "medium",
              reasoningSummary: "auto",
              include: ["reasoning.encrypted_content"],
            },
          },
        });

        return withLovableAiGatewayRunIdHeader(
          result.toUIMessageStreamResponse({
            originalMessages: messages,
            generateMessageId: generateId,
            sendReasoning: true,
            onFinish: async ({ responseMessage }) => {
              const { error } = await supabase.from("messages").insert({
                conversation_id: conversationId, user_id: userId, message_id: responseMessage.id || generateId(), role: "assistant", parts: responseMessage.parts as never,
              });
              if (error) console.error("save assistant msg", error);
            },
          }),
          runIdFetch,
        );
      },
    },
  },
});
