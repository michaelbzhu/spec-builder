import { afterEach, describe, expect, it } from "bun:test";
import { buildDiffPreview, buildPreviewMarkdown } from "./diffPreview";
import { useEditorStore, type Comment, type Document } from "./store";

const initialState = useEditorStore.getState();
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  useEditorStore.setState({
    view: initialState.view,
    generating: initialState.generating,
    documents: initialState.documents,
    activeDocumentId: initialState.activeDocumentId,
    showComments: initialState.showComments,
    activeCommentIdByDoc: initialState.activeCommentIdByDoc,
    pendingSelection: initialState.pendingSelection,
  });
});

function buildComment(id: string): Comment {
  return {
    id,
    selectedText: "beta",
    startLine: 1,
    endLine: 1,
    userComment: "replace beta",
    llmResponse: "suggested edit",
    loading: false,
    createdAt: Date.now(),
    topPosition: 0,
  };
}

function buildDoc(oldMarkdown: string, newMarkdown: string): Document {
  const diffPreview = buildDiffPreview(oldMarkdown, newMarkdown);
  return {
    id: "doc-1",
    title: "Doc",
    markdown: oldMarkdown,
    comments: [
      {
        ...buildComment("comment-1"),
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
      activeCommentIdByDoc: { "doc-1": "comment-1" },
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
      activeCommentIdByDoc: { "doc-1": "comment-1" },
      view: "editor",
    });

    useEditorStore.getState().rejectEdit("comment-1");

    const doc = useEditorStore.getState().documents[0];
    expect(doc?.markdown).toBe(oldMarkdown);
    expect(doc?.comments[0]?.editSuggestion?.status).toBe("rejected");
  });
});

describe("store active comment behavior", () => {
  it("addComment sets the active comment and forces comments visible", () => {
    globalThis.fetch = (() => new Promise<Response>(() => {})) as typeof fetch;

    useEditorStore.setState({
      documents: [
        {
          id: "doc-1",
          title: "Doc",
          markdown: "alpha\nbeta\n",
          comments: [],
        },
      ],
      activeDocumentId: "doc-1",
      showComments: false,
      activeCommentIdByDoc: { "doc-1": null },
      view: "editor",
    });

    useEditorStore.getState().addComment("alpha", 0, 0, "Please revise", 10);

    const state = useEditorStore.getState();
    const commentId = state.documents[0]?.comments[0]?.id;
    expect(commentId).toBeDefined();
    expect(state.activeCommentIdByDoc["doc-1"]).toBe(commentId);
    expect(state.showComments).toBe(true);
  });

  it("setActiveComment keeps only one active comment per document", () => {
    useEditorStore.setState({
      documents: [
        {
          id: "doc-1",
          title: "Doc",
          markdown: "alpha",
          comments: [buildComment("comment-1"), buildComment("comment-2")],
        },
      ],
      activeDocumentId: "doc-1",
      activeCommentIdByDoc: { "doc-1": "comment-1" },
      view: "editor",
    });

    useEditorStore.getState().setActiveComment("comment-2");

    const state = useEditorStore.getState();
    expect(state.activeCommentIdByDoc["doc-1"]).toBe("comment-2");
  });

  it("clearActiveComment sets active id to null", () => {
    useEditorStore.setState({
      documents: [
        {
          id: "doc-1",
          title: "Doc",
          markdown: "alpha",
          comments: [buildComment("comment-1")],
        },
      ],
      activeDocumentId: "doc-1",
      activeCommentIdByDoc: { "doc-1": "comment-1" },
      view: "editor",
    });

    useEditorStore.getState().clearActiveComment();

    const state = useEditorStore.getState();
    expect(state.activeCommentIdByDoc["doc-1"]).toBeNull();
  });

  it("switchDocument preserves active comment by document", () => {
    useEditorStore.setState({
      documents: [
        {
          id: "doc-1",
          title: "Doc 1",
          markdown: "alpha",
          comments: [buildComment("comment-1")],
        },
        {
          id: "doc-2",
          title: "Doc 2",
          markdown: "beta",
          comments: [buildComment("comment-2")],
        },
      ],
      activeDocumentId: "doc-1",
      activeCommentIdByDoc: {
        "doc-1": "comment-1",
        "doc-2": "comment-2",
      },
      view: "editor",
    });

    useEditorStore.getState().switchDocument("doc-2");
    let state = useEditorStore.getState();
    expect(state.activeDocumentId).toBe("doc-2");
    expect(state.activeCommentIdByDoc["doc-1"]).toBe("comment-1");
    expect(state.activeCommentIdByDoc["doc-2"]).toBe("comment-2");

    useEditorStore.getState().switchDocument("doc-1");
    state = useEditorStore.getState();
    expect(state.activeDocumentId).toBe("doc-1");
    expect(state.activeCommentIdByDoc["doc-1"]).toBe("comment-1");
    expect(state.activeCommentIdByDoc["doc-2"]).toBe("comment-2");
  });
});
