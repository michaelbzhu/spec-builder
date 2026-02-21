import { create } from "zustand";

export interface Comment {
  id: string;
  selectedText: string;
  startOffset: number;
  endOffset: number;
  userComment: string;
  llmResponse: string | null;
  loading: boolean;
  createdAt: number;
  topPosition: number;
}

interface EditorStore {
  markdown: string;
  setMarkdown: (md: string) => void;
  comments: Comment[];
  addComment: (
    selectedText: string,
    startOffset: number,
    endOffset: number,
    userComment: string,
    topPosition: number
  ) => void;
  pendingSelection: { text: string; start: number; end: number } | null;
  setPendingSelection: (
    sel: { text: string; start: number; end: number } | null
  ) => void;
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  markdown: `# Markdown Editor

Welcome to the **Markdown Editor**! Highlight text and add comments to get started.

## Features

- **Comment system** — highlight text and add comments
- **LLM responses** — get AI feedback on your writing
- Supports all standard Markdown syntax
- Clean, minimal interface

## Syntax Examples

### Text Formatting

*Italic*, **bold**, and \`inline code\`.

### Links & Images

[Visit GitHub](https://github.com)

### Code Blocks

\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}
\`\`\`

### Blockquotes

> "The best way to predict the future is to invent it."
> — Alan Kay

### Lists

1. First item
2. Second item
3. Third item

---

Happy writing!
`,

  setMarkdown: (md) => set({ markdown: md }),

  comments: [],

  addComment: (selectedText, startOffset, endOffset, userComment, topPosition) => {
    const id = crypto.randomUUID();
    const comment: Comment = {
      id,
      selectedText,
      startOffset,
      endOffset,
      userComment,
      llmResponse: null,
      loading: true,
      createdAt: Date.now(),
      topPosition,
    };

    set((state) => ({ comments: [comment, ...state.comments] }));

    fetch("/api/comment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selectedText, userComment }),
    })
      .then((res) => res.json())
      .then((data: any) => {
        const response = data.response ?? data.error ?? "No response.";
        set((state) => ({
          comments: state.comments.map((c) =>
            c.id === id ? { ...c, llmResponse: response, loading: false } : c
          ),
        }));
      })
      .catch((err) => {
        set((state) => ({
          comments: state.comments.map((c) =>
            c.id === id
              ? { ...c, llmResponse: "Error: " + err.message, loading: false }
              : c
          ),
        }));
      });
  },

  pendingSelection: null,
  setPendingSelection: (sel) => set({ pendingSelection: sel }),
}));
