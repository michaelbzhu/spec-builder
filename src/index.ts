import { serve } from "bun";
import Anthropic from "@anthropic-ai/sdk";
import index from "./index.html";

const anthropic = new Anthropic();

const server = serve({
  routes: {
    "/*": index,

    "/api/generate-spec": {
      POST: async (req) => {
        try {
          const { prompt } = await req.json();
          const message = await anthropic.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 4096,
            system: "You are a product spec writer. Given a user's idea of what they want to build, generate a clear, well-structured markdown specification document. Include sections for overview, goals, features, user stories, and technical considerations. Be concise but thorough. Output only the markdown document, no preamble.",
            messages: [
              {
                role: "user",
                content: prompt,
              },
            ],
          });
          const textBlock = message.content.find((b) => b.type === "text");
          const response = textBlock?.text ?? "No response generated.";
          return Response.json({ response });
        } catch (err: any) {
          console.error("Anthropic error:", err);
          return Response.json(
            { error: err.message ?? "LLM request failed" },
            { status: 500 }
          );
        }
      },
    },

    "/api/comment": {
      POST: async (req) => {
        try {
          const { selectedText, userComment } = await req.json();

          const message = await anthropic.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 1024,
            system: "You are a helpful writing assistant. The user has highlighted a passage of text and left a comment. Provide a brief, constructive response (1-3 sentences) addressing their comment in the context of the selected text.",
            messages: [
              {
                role: "user",
                content: `Selected text: "${selectedText}"\n\nComment: ${userComment}`,
              },
            ],
          });

          const textBlock = message.content.find((b) => b.type === "text");
          const response = textBlock?.text ?? "No response generated.";
          return Response.json({ response });
        } catch (err: any) {
          console.error("Anthropic error:", err);
          return Response.json(
            { error: err.message ?? "LLM request failed" },
            { status: 500 }
          );
        }
      },
    },
  },

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);
