import { create } from "zustand";
import {
  buildDiffPreview,
  buildPreviewMarkdown,
  replaceFirstExact,
  type DiffPreview,
} from "./diffPreview";

export interface EditSuggestion {
  id: string;
  oldString: string;
  newString: string;
  reasoning: string;
  status: "previewing" | "accepted" | "rejected";
  backupMarkdown: string;
  newMarkdown: string;
  previewMarkdown: string;
  diffPreview: DiffPreview;
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

interface EditorStore {
  view: "prompt" | "editor";
  generating: boolean;
  documents: Document[];
  activeDocumentId: string | null;
  showComments: boolean;
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

  toggleComments: () => set((state) => ({ showComments: !state.showComments })),

  applyEdit: (commentId: string) => {
    const { activeDocumentId } = get();
    if (!activeDocumentId) return;

    const doc = get().documents.find((d) => d.id === activeDocumentId);
    if (!doc) return;

    const comment = doc.comments.find((c) => c.id === commentId);
    if (!comment?.editSuggestion) return;

    const newMarkdown = comment.editSuggestion.newMarkdown;

    set((state) => ({
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

    const doc = get().documents.find((d) => d.id === activeDocumentId);
    if (!doc) return;

    const comment = doc.comments.find((c) => c.id === commentId);
    if (!comment?.editSuggestion) return;

    const { backupMarkdown } = comment.editSuggestion;

    // Restore the backup and mark as rejected
    set((state) => ({
      documents: state.documents.map((d) =>
        d.id === activeDocumentId
          ? {
              ...d,
              markdown: backupMarkdown,
              title: deriveTitle(backupMarkdown),
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
        let infoMessage: string | null = null;

        if (data.toolCall && data.toolCall.name === "edit_document") {
          const args = data.toolCall.arguments;
          const doc = get().documents.find((d) => d.id === activeDocumentId);

          if (doc) {
            const replacement = replaceFirstExact(
              doc.markdown,
              String(args.oldString ?? ""),
              String(args.newString ?? "")
            );

            if (replacement.found) {
              const backupMarkdown = doc.markdown;
              const newMarkdown = replacement.result;
              const diffPreview = buildDiffPreview(backupMarkdown, newMarkdown);
              const previewMarkdown = buildPreviewMarkdown(diffPreview);

              editSuggestion = {
                id: crypto.randomUUID(),
                oldString: String(args.oldString ?? ""),
                newString: String(args.newString ?? ""),
                reasoning: String(args.reasoning ?? ""),
                status: "previewing",
                backupMarkdown,
                newMarkdown,
                previewMarkdown,
                diffPreview,
                createdAt: Date.now(),
              };
            } else {
              infoMessage =
                "Could not preview this edit because the suggested original text was not found exactly.";
            }
          }
        }

        set((state) => ({
          documents: state.documents.map((d) =>
            d.id === activeDocumentId
              ? {
                  ...d,
                  comments: d.comments.map((c) =>
                    c.editSuggestion?.status === "previewing"
                      ? {
                          ...c,
                          editSuggestion: {
                            ...c.editSuggestion,
                            status: "rejected",
                          },
                        }
                      : c.id === commentId
                        ? {
                            ...c,
                            llmResponse: infoMessage
                              ? `${response}\n\n${infoMessage}`
                              : response,
                            loading: false,
                            editSuggestion,
                          }
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
