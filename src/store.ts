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
}

interface EditorStore {
  markdown: string;
  setMarkdown: (md: string) => void;
  comments: Comment[];
  addComment: (
    selectedText: string,
    startOffset: number,
    endOffset: number,
    userComment: string
  ) => void;
  pendingSelection: { text: string; start: number; end: number } | null;
  setPendingSelection: (
    sel: { text: string; start: number; end: number } | null
  ) => void;
}

const MOCK_RESPONSES = [
  "That's an interesting point. Consider expanding on this idea with more specific examples.",
  "This section could benefit from a clearer topic sentence to guide the reader.",
  "Good use of formatting here. The structure makes the content easy to follow.",
  "You might want to add a transition phrase to connect this with the previous section.",
  "This is well-written. One suggestion: try making the language more concise.",
  "Consider adding a code example here to illustrate the concept more clearly.",
];

export const useEditorStore = create<EditorStore>((set, get) => ({
  markdown: `# Markdown Editor

Welcome to the **Markdown Editor**! Start typing on the left to see comments on the right.

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

  addComment: (selectedText, startOffset, endOffset, userComment) => {
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
    };

    set((state) => ({ comments: [comment, ...state.comments] }));

    setTimeout(() => {
      const response =
        MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];
      set((state) => ({
        comments: state.comments.map((c) =>
          c.id === id ? { ...c, llmResponse: response, loading: false } : c
        ),
      }));
    }, 1000);
  },

  pendingSelection: null,
  setPendingSelection: (sel) => set({ pendingSelection: sel }),
}));
