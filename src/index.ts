import { serve } from "bun";
import OpenAI from "openai";
import index from "./index.html";

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Define the edit_document tool for LLM function calling
const editTool = {
  type: "function" as const,
  function: {
    name: "edit_document",
    description:
      "Suggest an edit to the document by replacing text. Use this when the user's comment suggests a specific change to the document that can be accomplished by finding and replacing text.",
    parameters: {
      type: "object",
      properties: {
        oldString: {
          type: "string",
          description: "The exact text to find and replace (must match exactly in the document)",
        },
        newString: {
          type: "string",
          description: "The replacement text",
        },
        reasoning: {
          type: "string",
          description: "Brief explanation of why this edit is suggested and how it addresses the user's comment",
        },
      },
      required: ["oldString", "newString", "reasoning"],
    },
  },
};

const server = serve({
  port: Number(process.env.PORT) || 3000,
  routes: {
    "/*": index,

    "/api/generate-spec": {
      POST: async (req) => {
        try {
          const { prompt } = await req.json();
          const completion = await openai.chat.completions.create({
            model: "openai/gpt-oss-120b:nitro",
            max_tokens: 4096,
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
          const response = completion.choices[0]?.message?.content ?? "No response generated.";
          return Response.json({ response });
        } catch (err: any) {
          console.error("OpenRouter error:", err);
          return Response.json({ error: err.message ?? "LLM request failed" }, { status: 500 });
        }
      },
    },

    "/api/comment": {
      POST: async (req) => {
        try {
          const { selectedText, userComment, documentText } = await req.json();

          const completion = await openai.chat.completions.create({
            model: "openai/gpt-oss-120b:nitro",
            max_tokens: 2048,
            messages: [
              {
                role: "system",
                content:
                  "You are a helpful writing assistant. The user has highlighted a passage of text and left a comment. Provide a brief, constructive response addressing their comment. Prefer bullet points over tables. If the user is asking for a specific change that can be made to the document, use the edit_document tool to suggest the exact change.",
              },
              {
                role: "user",
                content: `<full_document>
${documentText ?? ""}
</full_document>

<selected_text>
${selectedText ?? ""}
</selected_text>

<user_comment>
${userComment ?? ""}
</user_comment>`,
              },
            ],
            tools: [editTool],
            tool_choice: "auto",
          });

          const message = completion.choices[0]?.message;

          // Check if the model used a tool
          if (message?.tool_calls && message.tool_calls.length > 0) {
            const toolCall = message.tool_calls[0];
            const args = JSON.parse(toolCall.function.arguments);

            return Response.json({
              response: message.content || "I've suggested an edit to the document based on your comment.",
              toolCall: {
                name: toolCall.function.name,
                arguments: args,
              },
            });
          }

          // Regular text response
          const response = message?.content ?? "No response generated.";
          return Response.json({ response });
        } catch (err: any) {
          console.error("OpenRouter error:", err);
          return Response.json({ error: err.message ?? "LLM request failed" }, { status: 500 });
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
