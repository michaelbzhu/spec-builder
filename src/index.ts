import { serve } from "bun";
import OpenAI from "openai";
import index from "./index.html";

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const server = serve({
  routes: {
    "/*": index,

    "/api/generate-spec": {
      POST: async (req) => {
        try {
          const { prompt } = await req.json();
          const completion = await openai.chat.completions.create({
            model: "deepseek/deepseek-v3.2",
            messages: [
              {
                role: "system",
                content:
                  "You are a product spec writer. Given a user's idea of what they want to build, generate a clear, well-structured markdown specification document. Include sections for overview, goals, features, user stories, and technical considerations. Be concise but thorough. Output only the markdown document, no preamble.",
              },
              {
                role: "user",
                content: prompt,
              },
            ],
          });
          const response =
            completion.choices[0]?.message?.content ?? "No response generated.";
          return Response.json({ response });
        } catch (err: any) {
          console.error("OpenRouter error:", err);
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

          const completion = await openai.chat.completions.create({
            model: "deepseek/deepseek-v3.2",
            messages: [
              {
                role: "system",
                content:
                  "You are a helpful writing assistant. The user has highlighted a passage of text and left a comment. Provide a brief, constructive response (1-3 sentences) addressing their comment in the context of the selected text.",
              },
              {
                role: "user",
                content: `Selected text: "${selectedText}"\n\nComment: ${userComment}`,
              },
            ],
          });

          const response =
            completion.choices[0]?.message?.content ?? "No response generated.";
          return Response.json({ response });
        } catch (err: any) {
          console.error("OpenRouter error:", err);
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
