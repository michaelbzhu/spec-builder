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
  const createdAt = Date.now();
  return {
    id,
    selectedText: "beta",
    startLine: 1,
    endLine: 1,
    userComment: "replace beta",
    llmResponse: "suggested edit",
    messages: [
      {
        id: `${id}-user`,
        role: "user",
        content: "replace beta",
        createdAt,
      },
      {
        id: `${id}-assistant`,
        role: "assistant",
        content: "suggested edit",
        createdAt: createdAt + 1,
      },
    ],
    loading: false,
    createdAt,
    topPosition: 0,
  };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
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

describe("store comment thread continuation", () => {
  it("continueCommentThread appends user/assistant messages and clears loading", async () => {
    let capturedRequestBody: any = null;

    globalThis.fetch = (async (_input, init) => {
      if (typeof init?.body === "string") {
        capturedRequestBody = JSON.parse(init.body);
      }

      return new Response(JSON.stringify({ response: "Follow-up response" }), {
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    useEditorStore.setState({
      documents: [
        {
          id: "doc-1",
          title: "Doc",
          markdown: "alpha\nbeta\n",
          comments: [buildComment("comment-1")],
        },
      ],
      activeDocumentId: "doc-1",
      activeCommentIdByDoc: { "doc-1": "comment-1" },
      view: "editor",
    });

    useEditorStore.getState().continueCommentThread("comment-1", "Can you expand this?");

    let comment = useEditorStore.getState().documents[0]?.comments[0];
    const optimisticMessage = comment ? comment.messages[comment.messages.length - 1] : undefined;
    expect(comment?.loading).toBe(true);
    expect(optimisticMessage?.role).toBe("user");
    expect(optimisticMessage?.content).toBe("Can you expand this?");
    expect(capturedRequestBody?.threadMessages?.at(-1)?.content).toBe("Can you expand this?");

    await flushMicrotasks();

    comment = useEditorStore.getState().documents[0]?.comments[0];
    const lastMessage = comment ? comment.messages[comment.messages.length - 1] : undefined;
    expect(comment?.loading).toBe(false);
    expect(lastMessage?.role).toBe("assistant");
    expect(lastMessage?.content).toBe("Follow-up response");
  });

  it("continueCommentThread does nothing for empty input or loading comment", () => {
    let fetchCount = 0;
    globalThis.fetch = (() => {
      fetchCount += 1;
      return new Promise<Response>(() => {});
    }) as typeof fetch;

    useEditorStore.setState({
      documents: [
        {
          id: "doc-1",
          title: "Doc",
          markdown: "alpha\nbeta\n",
          comments: [buildComment("comment-1")],
        },
      ],
      activeDocumentId: "doc-1",
      activeCommentIdByDoc: { "doc-1": "comment-1" },
      view: "editor",
    });

    useEditorStore.getState().continueCommentThread("comment-1", "   ");
    expect(fetchCount).toBe(0);

    useEditorStore.setState((state) => ({
      documents: state.documents.map((doc) =>
        doc.id === "doc-1"
          ? {
              ...doc,
              comments: doc.comments.map((comment) =>
                comment.id === "comment-1" ? { ...comment, loading: true } : comment
              ),
            }
          : doc
      ),
    }));

    useEditorStore.getState().continueCommentThread("comment-1", "Another message");
    expect(fetchCount).toBe(0);
  });
});
