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
  view: "prompt" | "editor";
  generating: boolean;
  markdown: string;
  setMarkdown: (md: string) => void;
  generateSpec: (prompt: string) => void;
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
  view: "prompt",
  generating: false,
  markdown: "",

  setMarkdown: (md) => set({ markdown: md }),

  generateSpec: (prompt: string) => {
    set({ generating: true });
    fetch("/api/generate-spec", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    })
      .then((res) => res.json())
      .then((data: any) => {
        const spec = data.response ?? "# Error\n\nFailed to generate spec.";
        set({ markdown: spec, view: "editor", generating: false });
      })
      .catch((err) => {
        set({
          markdown: `# Error\n\n${err.message}`,
          view: "editor",
          generating: false,
        });
      });
  },

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
