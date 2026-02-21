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

export interface Document {
  id: string;
  title: string;
  markdown: string;
  comments: Comment[];
}

function deriveTitle(markdown: string): string {
  const headingMatch = markdown.match(/^#\s+(.+)$/m);
  if (headingMatch) return headingMatch[1].trim();
  const firstLine = markdown.split("\n").find((l) => l.trim());
  if (firstLine) return firstLine.trim().slice(0, 60);
  return "Untitled";
}

interface EditorStore {
  view: "prompt" | "editor";
  generating: boolean;
  documents: Document[];
  activeDocumentId: string | null;
  generateSpec: (prompt: string) => void;
  setMarkdown: (md: string) => void;
  addComment: (
    selectedText: string,
    startOffset: number,
    endOffset: number,
    userComment: string,
    topPosition: number
  ) => void;
  switchDocument: (id: string) => void;
  deleteDocument: (id: string) => void;
  goToPrompt: () => void;
  pendingSelection: { text: string; start: number; end: number } | null;
  setPendingSelection: (
    sel: { text: string; start: number; end: number } | null
  ) => void;
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  view: "prompt",
  generating: false,
  documents: [],
  activeDocumentId: null,

  goToPrompt: () => set({ view: "prompt", pendingSelection: null }),

  switchDocument: (id: string) => {
    const doc = get().documents.find((d) => d.id === id);
    if (doc) {
      set({ activeDocumentId: id, view: "editor", pendingSelection: null });
    }
  },

  deleteDocument: (id: string) => {
    const { documents, activeDocumentId } = get();
    const remaining = documents.filter((d) => d.id !== id);
    if (remaining.length === 0) {
      set({ documents: [], activeDocumentId: null, view: "prompt" });
    } else if (activeDocumentId === id) {
      set({ documents: remaining, activeDocumentId: remaining[0].id, view: "editor" });
    } else {
      set({ documents: remaining });
    }
  },

  setMarkdown: (md) => {
    const { activeDocumentId } = get();
    if (!activeDocumentId) return;
    set((state) => ({
      documents: state.documents.map((d) =>
        d.id === activeDocumentId
          ? { ...d, markdown: md, title: deriveTitle(md) }
          : d
      ),
    }));
  },

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
        const newDoc: Document = {
          id: crypto.randomUUID(),
          title: deriveTitle(spec),
          markdown: spec,
          comments: [],
        };
        set((state) => ({
          documents: [...state.documents, newDoc],
          activeDocumentId: newDoc.id,
          view: "editor",
          generating: false,
        }));
      })
      .catch((err) => {
        const errorMd = `# Error\n\n${err.message}`;
        const newDoc: Document = {
          id: crypto.randomUUID(),
          title: "Error",
          markdown: errorMd,
          comments: [],
        };
        set((state) => ({
          documents: [...state.documents, newDoc],
          activeDocumentId: newDoc.id,
          view: "editor",
          generating: false,
        }));
      });
  },

  addComment: (selectedText, startOffset, endOffset, userComment, topPosition) => {
    const { activeDocumentId } = get();
    if (!activeDocumentId) return;

    const commentId = crypto.randomUUID();
    const comment: Comment = {
      id: commentId,
      selectedText,
      startOffset,
      endOffset,
      userComment,
      llmResponse: null,
      loading: true,
      createdAt: Date.now(),
      topPosition,
    };

    set((state) => ({
      documents: state.documents.map((d) =>
        d.id === activeDocumentId
          ? { ...d, comments: [comment, ...d.comments] }
          : d
      ),
    }));

    fetch("/api/comment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selectedText, userComment }),
    })
      .then((res) => res.json())
      .then((data: any) => {
        const response = data.response ?? data.error ?? "No response.";
        set((state) => ({
          documents: state.documents.map((d) =>
            d.id === activeDocumentId
              ? {
                  ...d,
                  comments: d.comments.map((c) =>
                    c.id === commentId
                      ? { ...c, llmResponse: response, loading: false }
                      : c
                  ),
                }
              : d
          ),
        }));
      })
      .catch((err) => {
        set((state) => ({
          documents: state.documents.map((d) =>
            d.id === activeDocumentId
              ? {
                  ...d,
                  comments: d.comments.map((c) =>
                    c.id === commentId
                      ? { ...c, llmResponse: "Error: " + err.message, loading: false }
                      : c
                  ),
                }
              : d
          ),
        }));
      });
  },

  pendingSelection: null,
  setPendingSelection: (sel) => set({ pendingSelection: sel }),
}));
