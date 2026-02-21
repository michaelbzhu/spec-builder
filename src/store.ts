import { create } from "zustand";

export interface EditSuggestion {
  id: string;
  oldString: string;
  newString: string;
  reasoning: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: number;
}

export interface Comment {
  id: string;
  selectedText: string;
  startLine: number;
  endLine: number;
  userComment: string;
  llmResponse: string | null;
  loading: boolean;
  createdAt: number;
  topPosition: number;
  editSuggestion?: EditSuggestion;
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

interface HistoryEntry {
  documentId: string;
  markdown: string;
}

interface EditorStore {
  view: "prompt" | "editor";
  generating: boolean;
  documents: Document[];
  activeDocumentId: string | null;
  showComments: boolean;
  history: HistoryEntry[];
  historyIndex: number;
  generateSpec: (prompt: string) => void;
  setMarkdown: (md: string) => void;
  addComment: (
    selectedText: string,
    startLine: number,
    endLine: number,
    userComment: string,
    topPosition: number
  ) => void;
  switchDocument: (id: string) => void;
  deleteDocument: (id: string) => void;
  goToPrompt: () => void;
  toggleComments: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  applyEdit: (commentId: string) => void;
  rejectEdit: (commentId: string) => void;
  dismissEdit: (commentId: string) => void;
  pendingSelection: { text: string; startLine: number; endLine: number } | null;
  setPendingSelection: (
    sel: { text: string; startLine: number; endLine: number } | null
  ) => void;
}

const defaultDoc: Document = {
  id: "welcome",
  title: "Welcome",
  markdown: `# Welcome

This is your default document. Start editing or create a new document from the sidebar.

## Getting Started

- Use **Cmd + Click** to select lines
- Add comments to discuss sections
- Create new documents with the + button`,
  comments: [],
};

export const useEditorStore = create<EditorStore>((set, get) => ({
  view: "editor",
  generating: false,
  documents: [defaultDoc],
  activeDocumentId: "welcome",
  showComments: true,
  history: [],
  historyIndex: -1,

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
    const { activeDocumentId, history, historyIndex } = get();
    if (!activeDocumentId) return;

    // Add current state to history before changing
    const currentDoc = get().documents.find((d) => d.id === activeDocumentId);
    if (currentDoc && currentDoc.markdown !== md) {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push({ documentId: activeDocumentId, markdown: currentDoc.markdown });
      // Keep only last 50 entries
      if (newHistory.length > 50) {
        newHistory.shift();
      }
      set({
        history: newHistory,
        historyIndex: newHistory.length - 1,
      });
    }

    set((state) => ({
      documents: state.documents.map((d) =>
        d.id === activeDocumentId
          ? { ...d, markdown: md, title: deriveTitle(md) }
          : d
      ),
    }));
  },

  toggleComments: () => set((state) => ({ showComments: !state.showComments })),

  undo: () => {
    const { history, historyIndex, activeDocumentId } = get();
    if (historyIndex < 0 || !activeDocumentId) return;

    const entry = history[historyIndex];
    if (entry.documentId !== activeDocumentId) return;

    // Save current state for redo
    const currentDoc = get().documents.find((d) => d.id === activeDocumentId);
    if (!currentDoc) return;

    set((state) => ({
      historyIndex: historyIndex - 1,
      documents: state.documents.map((d) =>
        d.id === activeDocumentId ? { ...d, markdown: entry.markdown, title: deriveTitle(entry.markdown) } : d
      ),
    }));
  },

  redo: () => {
    const { history, historyIndex, activeDocumentId } = get();
    if (historyIndex >= history.length - 1 || !activeDocumentId) return;

    const entry = history[historyIndex + 1];
    if (entry.documentId !== activeDocumentId) return;

    set((state) => ({
      historyIndex: historyIndex + 1,
      documents: state.documents.map((d) =>
        d.id === activeDocumentId ? { ...d, markdown: entry.markdown, title: deriveTitle(entry.markdown) } : d
      ),
    }));
  },

  canUndo: () => {
    const { history, historyIndex, activeDocumentId } = get();
    if (historyIndex < 0 || !activeDocumentId) return false;
    return history[historyIndex]?.documentId === activeDocumentId;
  },

  canRedo: () => {
    const { history, historyIndex, activeDocumentId } = get();
    if (historyIndex >= history.length - 1 || !activeDocumentId) return false;
    return history[historyIndex + 1]?.documentId === activeDocumentId;
  },

  applyEdit: (commentId: string) => {
    const { activeDocumentId } = get();
    if (!activeDocumentId) return;

    const doc = get().documents.find((d) => d.id === activeDocumentId);
    if (!doc) return;

    const comment = doc.comments.find((c) => c.id === commentId);
    if (!comment?.editSuggestion) return;

    const { oldString, newString } = comment.editSuggestion;

    // Check if oldString exists in the document
    if (!doc.markdown.includes(oldString)) {
      console.error("Old string not found in document");
      // Mark as rejected since we can't apply it
      set((state) => ({
        documents: state.documents.map((d) =>
          d.id === activeDocumentId
            ? {
                ...d,
                comments: d.comments.map((c) =>
                  c.id === commentId
                    ? { ...c, editSuggestion: { ...c.editSuggestion!, status: "rejected" } }
                    : c
                ),
              }
            : d
        ),
      }));
      return;
    }

    // Save current state to history before applying edit
    const newHistory = get().history.slice(0, get().historyIndex + 1);
    newHistory.push({ documentId: activeDocumentId, markdown: doc.markdown });
    if (newHistory.length > 50) {
      newHistory.shift();
    }

    // Perform the replacement
    const newMarkdown = doc.markdown.replace(oldString, newString);

    set((state) => ({
      history: newHistory,
      historyIndex: newHistory.length - 1,
      documents: state.documents.map((d) =>
        d.id === activeDocumentId
          ? {
              ...d,
              markdown: newMarkdown,
              title: deriveTitle(newMarkdown),
              comments: d.comments.map((c) =>
                c.id === commentId
                  ? { ...c, editSuggestion: { ...c.editSuggestion!, status: "accepted" } }
                  : c
              ),
            }
          : d
      ),
    }));
  },

  rejectEdit: (commentId: string) => {
    const { activeDocumentId } = get();
    if (!activeDocumentId) return;

    set((state) => ({
      documents: state.documents.map((d) =>
        d.id === activeDocumentId
          ? {
              ...d,
              comments: d.comments.map((c) =>
                c.id === commentId
                  ? { ...c, editSuggestion: { ...c.editSuggestion!, status: "rejected" } }
                  : c
              ),
            }
          : d
      ),
    }));
  },

  dismissEdit: (commentId: string) => {
    const { activeDocumentId } = get();
    if (!activeDocumentId) return;

    set((state) => ({
      documents: state.documents.map((d) =>
        d.id === activeDocumentId
          ? {
              ...d,
              comments: d.comments.map((c) =>
                c.id === commentId
                  ? { ...c, editSuggestion: undefined }
                  : c
              ),
            }
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

  addComment: (selectedText, startLine, endLine, userComment, topPosition) => {
    const { activeDocumentId } = get();
    if (!activeDocumentId) return;

    const commentId = crypto.randomUUID();
    const comment: Comment = {
      id: commentId,
      selectedText,
      startLine,
      endLine,
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
        
        // Check if there's a tool call (edit suggestion)
        let editSuggestion: EditSuggestion | undefined;
        if (data.toolCall && data.toolCall.name === "edit_document") {
          const args = data.toolCall.arguments;
          editSuggestion = {
            id: crypto.randomUUID(),
            oldString: args.oldString,
            newString: args.newString,
            reasoning: args.reasoning,
            status: "pending",
            createdAt: Date.now(),
          };
        }

        set((state) => ({
          documents: state.documents.map((d) =>
            d.id === activeDocumentId
              ? {
                  ...d,
                  comments: d.comments.map((c) =>
                    c.id === commentId
                      ? { ...c, llmResponse: response, loading: false, editSuggestion }
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
