import { afterEach, describe, expect, it } from "bun:test";
import { buildDiffPreview, buildPreviewMarkdown } from "./diffPreview";
import { useEditorStore, type Document } from "./store";

const initialState = useEditorStore.getState();

afterEach(() => {
  useEditorStore.setState({
    view: initialState.view,
    generating: initialState.generating,
    documents: initialState.documents,
    activeDocumentId: initialState.activeDocumentId,
    showComments: initialState.showComments,
    pendingSelection: initialState.pendingSelection,
  });
});

function buildDoc(oldMarkdown: string, newMarkdown: string): Document {
  const diffPreview = buildDiffPreview(oldMarkdown, newMarkdown);
  return {
    id: "doc-1",
    title: "Doc",
    markdown: oldMarkdown,
    comments: [
      {
        id: "comment-1",
        selectedText: "beta",
        startLine: 1,
        endLine: 1,
        userComment: "replace beta",
        llmResponse: "suggested edit",
        loading: false,
        createdAt: Date.now(),
        topPosition: 0,
        editSuggestion: {
          id: "edit-1",
          oldString: "beta",
          newString: "gamma",
          reasoning: "replace wording",
          status: "previewing",
          backupMarkdown: oldMarkdown,
          newMarkdown,
          previewMarkdown: buildPreviewMarkdown(diffPreview),
          diffPreview,
          createdAt: Date.now(),
        },
      },
    ],
  };
}

describe("store edit transitions", () => {
  it("applyEdit writes newMarkdown and marks status accepted", () => {
    const oldMarkdown = "alpha\nbeta\n";
    const newMarkdown = "alpha\ngamma\n";

    useEditorStore.setState({
      documents: [buildDoc(oldMarkdown, newMarkdown)],
      activeDocumentId: "doc-1",
      view: "editor",
    });

    useEditorStore.getState().applyEdit("comment-1");

    const doc = useEditorStore.getState().documents[0];
    expect(doc?.markdown).toBe(newMarkdown);
    expect(doc?.comments[0]?.editSuggestion?.status).toBe("accepted");
  });

  it("rejectEdit restores backupMarkdown and marks status rejected", () => {
    const oldMarkdown = "alpha\nbeta\n";
    const newMarkdown = "alpha\ngamma\n";

    useEditorStore.setState({
      documents: [buildDoc(oldMarkdown, newMarkdown)],
      activeDocumentId: "doc-1",
      view: "editor",
    });

    useEditorStore.getState().rejectEdit("comment-1");

    const doc = useEditorStore.getState().documents[0];
    expect(doc?.markdown).toBe(oldMarkdown);
    expect(doc?.comments[0]?.editSuggestion?.status).toBe("rejected");
  });
});
