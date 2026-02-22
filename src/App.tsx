import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { marked } from "marked";
import { parsePreviewMarkdown } from "./diffPreview";
import { useEditorStore, type Comment } from "./store";

import "./index.css";

function GithubDiffView({
  previewMarkdown,
}: {
  previewMarkdown: string;
}) {
  const lines = parsePreviewMarkdown(previewMarkdown);

  return (
    <div className="gh-diff" role="presentation" aria-label="Suggested changes">
      <div className="gh-diff-hunk">
        {lines.map((line, index) => {
          const className =
            line.kind === "del"
              ? "gh-line gh-line-del"
              : line.kind === "add"
                ? "gh-line gh-line-add"
                : "gh-line gh-line-context";

          return (
            <div key={index} className={className}>
              <span className="gh-line-code">{line.text.length === 0 ? "\u00A0" : line.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function buildLineLabel(comment: Comment): string {
  if (comment.startLine === comment.endLine) {
    return `Line ${comment.startLine + 1}`;
  }

  return `Lines ${comment.startLine + 1}-${comment.endLine + 1}`;
}

function escapeHtml(markdown: string): string {
  return markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderMarkdown(markdown: string): string {
  const parsed = marked.parse(escapeHtml(markdown), {
    async: false,
    gfm: true,
    breaks: true,
  });
  return typeof parsed === "string" ? parsed : "";
}

function MarkdownCommentResponse({ markdown }: { markdown: string }) {
  const html = useMemo(() => renderMarkdown(markdown), [markdown]);

  return (
    <div
      className="comment-llm comment-llm-markdown"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function EditSuggestionCard({ comment }: { comment: Comment }) {
  const applyEdit = useEditorStore((s) => s.applyEdit);
  const rejectEdit = useEditorStore((s) => s.rejectEdit);
  const dismissEdit = useEditorStore((s) => s.dismissEdit);

  const edit = comment.editSuggestion;
  if (!edit) return null;

  if (edit.status === "previewing") {
    return (
      <div className="edit-suggestion">
        <div className="edit-suggestion-header">
          <span className="edit-suggestion-icon">👁️</span>
          <span className="edit-suggestion-title">Previewing Edit</span>
        </div>
        <div className="edit-suggestion-reasoning">{edit.reasoning}</div>
        <div className="edit-actions">
          <button className="edit-btn edit-btn-accept" onClick={() => applyEdit(comment.id)}>
            Accept
          </button>
          <button className="edit-btn edit-btn-reject" onClick={() => rejectEdit(comment.id)}>
            Reject
          </button>
        </div>
      </div>
    );
  }

  if (edit.status === "accepted") {
    return (
      <div className="edit-status edit-status-accepted">
        <span className="edit-status-icon">✓</span>
        <span>Edit applied</span>
        <button
          className="edit-status-dismiss"
          onClick={() => dismissEdit(comment.id)}
          title="Dismiss"
        >
          ×
        </button>
      </div>
    );
  }

  if (edit.status === "rejected") {
    return (
      <div className="edit-status edit-status-rejected">
        <span className="edit-status-icon">✗</span>
        <span>Edit rejected - changes reverted</span>
        <button
          className="edit-status-dismiss"
          onClick={() => dismissEdit(comment.id)}
          title="Dismiss"
        >
          ×
        </button>
      </div>
    );
  }

  return null;
}

function CommentThreadContent({ comment }: { comment: Comment }) {
  return (
    <>
      <div className="comment-selected-text">"{comment.selectedText}"</div>
      <div className="comment-user">{comment.userComment}</div>
      {comment.loading ? (
        <div className="comment-loading" aria-label="Generating response">
          <span className="loading-dot" />
          <span className="loading-dot" />
          <span className="loading-dot" />
        </div>
      ) : (
        <>
          <MarkdownCommentResponse markdown={comment.llmResponse ?? ""} />
          {comment.editSuggestion && <EditSuggestionCard comment={comment} />}
        </>
      )}
    </>
  );
}

function CommentMarkersOverlay({
  comments,
  activeCommentId,
  scrollTop,
  onSelectComment,
}: {
  comments: Comment[];
  activeCommentId: string | null;
  scrollTop: number;
  onSelectComment: (commentId: string) => void;
}) {
  const markerItems = useMemo(() => {
    const sorted = [...comments].sort((a, b) => {
      if (a.topPosition !== b.topPosition) return a.topPosition - b.topPosition;
      if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
      return a.id.localeCompare(b.id);
    });

    const perRowCount = new Map<number, number>();

    return sorted.map((comment) => {
      const rowKey = Math.round(comment.topPosition / 16);
      const stackIndex = perRowCount.get(rowKey) ?? 0;
      perRowCount.set(rowKey, stackIndex + 1);

      return {
        comment,
        stackIndex,
      };
    });
  }, [comments]);

  return (
    <div className="comment-markers-overlay" aria-hidden="true">
      {markerItems.map(({ comment, stackIndex }) => {
        const isActive = comment.id === activeCommentId;

        return (
          <button
            key={comment.id}
            type="button"
            className={`comment-marker${isActive ? " comment-marker--active" : ""}${comment.loading ? " comment-marker--loading" : ""}`}
            style={{
              top: comment.topPosition - scrollTop - 8,
              right: 8 + stackIndex * 13,
            }}
            onClick={() => onSelectComment(comment.id)}
            title={`Open comment on ${buildLineLabel(comment)}`}
            aria-label={`Open comment on ${buildLineLabel(comment)}`}
          >
            <span className="comment-marker-dot" />
          </button>
        );
      })}
    </div>
  );
}

function CommentChatSidebar({
  activeComment,
  onClearActive,
}: {
  activeComment: Comment;
  onClearActive: () => void;
}) {
  return (
    <aside className="chat-sidebar" aria-label="Comment chat sidebar">
      <div className="chat-thread-header">
        <div className="chat-thread-meta">
          <span className="chat-thread-title">Comment Thread</span>
          <span className="chat-thread-line">{buildLineLabel(activeComment)}</span>
        </div>
        <button
          type="button"
          className="chat-thread-clear"
          onClick={onClearActive}
          title="Clear active comment"
          aria-label="Clear active comment"
        >
          ×
        </button>
      </div>
      <div className="chat-thread-body">
        <CommentThreadContent comment={activeComment} />
      </div>
    </aside>
  );
}

function Toolbar() {
  const activeDoc = useEditorStore((s) => s.documents.find((d) => d.id === s.activeDocumentId));

  const charCount = activeDoc?.markdown.length ?? 0;
  const commentCount = activeDoc?.comments.length ?? 0;
  const commentLabel = `${commentCount} comment${commentCount === 1 ? "" : "s"}`;

  return (
    <div className="editor-toolbar">
      <div className="toolbar-left">
        <span className="toolbar-char-count">{charCount} chars</span>
      </div>
      <div className="toolbar-right">
        <span className="toolbar-char-count">{commentLabel}</span>
      </div>
    </div>
  );
}

function Sidebar() {
  const documents = useEditorStore((s) => s.documents);
  const activeDocumentId = useEditorStore((s) => s.activeDocumentId);
  const switchDocument = useEditorStore((s) => s.switchDocument);
  const deleteDocument = useEditorStore((s) => s.deleteDocument);
  const goToPrompt = useEditorStore((s) => s.goToPrompt);

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-label">Documents</span>
        <button className="sidebar-new-btn" onClick={goToPrompt} title="New document">
          +
        </button>
      </div>
      <div className="sidebar-list">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className={`sidebar-item ${doc.id === activeDocumentId ? "sidebar-item--active" : ""}`}
            onClick={() => switchDocument(doc.id)}
          >
            <span className="sidebar-item-title">{doc.title}</span>
            <button
              className="sidebar-item-delete"
              onClick={(e) => {
                e.stopPropagation();
                deleteDocument(doc.id);
              }}
              title="Delete document"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function PromptView() {
  const [input, setInput] = useState("");
  const generateSpec = useEditorStore((s) => s.generateSpec);
  const generating = useEditorStore((s) => s.generating);

  const handleSubmit = useCallback(() => {
    if (!input.trim() || generating) return;
    generateSpec(input.trim());
  }, [input, generating, generateSpec]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <div className="prompt-view">
      <div className="prompt-box">
        <h1 className="prompt-title">What do you want to build?</h1>
        <textarea
          className="prompt-input"
          placeholder="Describe your idea..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          disabled={generating}
          rows={3}
        />
        <button
          className="prompt-submit"
          onClick={handleSubmit}
          disabled={!input.trim() || generating}
        >
          {generating ? "Generating..." : "Generate Spec"}
        </button>
      </div>
    </div>
  );
}

function EditorView() {
  const activeDocumentId = useEditorStore((s) => s.activeDocumentId);
  const activeDoc = useEditorStore((s) => s.documents.find((d) => d.id === s.activeDocumentId));
  const setMarkdown = useEditorStore((s) => s.setMarkdown);
  const pendingSelection = useEditorStore((s) => s.pendingSelection);
  const setPendingSelection = useEditorStore((s) => s.setPendingSelection);
  const addComment = useEditorStore((s) => s.addComment);
  const setActiveComment = useEditorStore((s) => s.setActiveComment);
  const clearActiveComment = useEditorStore((s) => s.clearActiveComment);
  const activeCommentId = useEditorStore((s) => {
    if (!s.activeDocumentId) return null;
    return s.activeCommentIdByDoc[s.activeDocumentId] ?? null;
  });

  const markdown = activeDoc?.markdown ?? "";
  const comments = activeDoc?.comments ?? [];
  const activeComment = activeCommentId
    ? comments.find((comment) => comment.id === activeCommentId) ?? null
    : null;

  const previewComment = comments.find(
    (c) => c.editSuggestion?.status === "previewing" && c.editSuggestion.previewMarkdown
  );
  const previewMarkdown = previewComment?.editSuggestion?.previewMarkdown ?? "";
  const isPreviewing = Boolean(previewMarkdown);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const anchorLineRef = useRef<number | null>(null);

  const [commentInput, setCommentInput] = useState("");
  const [lineHeight, setLineHeight] = useState(0);
  const [paddingTop, setPaddingTop] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [pendingLines, setPendingLines] = useState<{ start: number; end: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const style = getComputedStyle(el);
    const fontSize = parseFloat(style.fontSize);
    const lh = parseFloat(style.lineHeight);
    setLineHeight(isNaN(lh) ? fontSize * 1.7 : lh);
    setPaddingTop(parseFloat(style.paddingTop) || 0);
  }, [activeDocumentId]);

  useEffect(() => {
    if (!activeCommentId) return;

    const activeCommentExists = comments.some((comment) => comment.id === activeCommentId);
    if (!activeCommentExists) {
      clearActiveComment();
    }
  }, [activeCommentId, clearActiveComment, comments]);

  useEffect(() => {
    if (!activeComment || isPreviewing) return;

    const el = textareaRef.current;
    if (!el) return;

    const targetTop = Math.max(0, activeComment.topPosition - el.clientHeight * 0.4);
    el.scrollTo({ top: targetTop, behavior: "smooth" });
    setScrollTop(targetTop);
  }, [activeCommentId, activeDocumentId, activeComment, isPreviewing]);

  useEffect(() => {
    if (!isPreviewing) return;
    setPendingLines(null);
    setPendingSelection(null);
    setCommentInput("");
    setIsDragging(false);
  }, [isPreviewing, setPendingSelection]);

  const getLineFromY = useCallback(
    (clientY: number) => {
      const el = textareaRef.current;
      if (!el || lineHeight === 0) return 0;
      const rect = el.getBoundingClientRect();
      const y = clientY - rect.top + el.scrollTop - paddingTop;
      const totalLines = markdown.split("\n").length;
      return Math.max(0, Math.min(Math.floor(y / lineHeight), totalLines - 1));
    },
    [lineHeight, paddingTop, markdown]
  );

  const buildRangeStyle = useCallback(
    (range: { start: number; end: number } | null) => {
      if (!range || lineHeight <= 0) return null;

      return {
        top: paddingTop + range.start * lineHeight - scrollTop,
        height: (range.end - range.start + 1) * lineHeight,
      };
    },
    [lineHeight, paddingTop, scrollTop]
  );

  const handleSelectComment = useCallback(
    (commentId: string) => {
      if (isPreviewing) return;

      const targetComment = comments.find((comment) => comment.id === commentId);
      if (!targetComment) return;

      setActiveComment(commentId);
      setPendingLines(null);
      setPendingSelection(null);
      setCommentInput("");
      setIsDragging(false);
      anchorLineRef.current = null;
    },
    [comments, isPreviewing, setActiveComment, setPendingSelection]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setMarkdown(e.target.value);
    },
    [setMarkdown]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Escape") {
        setPendingLines(null);
        setPendingSelection(null);
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        const textarea = e.currentTarget;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const value = textarea.value;
        setMarkdown(value.substring(0, start) + "  " + value.substring(end));
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        });
      }
    },
    [setMarkdown, setPendingSelection]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isPreviewing) return;
      if (e.button !== 0) return;

      if (!e.metaKey) {
        setPendingLines(null);
        setPendingSelection(null);
        return;
      }

      const line = getLineFromY(e.clientY);
      anchorLineRef.current = line;
      setIsDragging(true);
      setPendingLines({ start: line, end: line });

      const lines = markdown.split("\n");
      const text = lines[line] ?? "";
      setPendingSelection({ text, startLine: line, endLine: line });
      e.preventDefault();
    },
    [getLineFromY, isPreviewing, markdown, setPendingSelection]
  );

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isPreviewing || !isDragging || anchorLineRef.current === null) return;
      const line = getLineFromY(e.clientY);
      const anchor = anchorLineRef.current;
      const startLine = Math.min(anchor, line);
      const endLine = Math.max(anchor, line);
      setPendingLines({ start: startLine, end: endLine });

      const lines = markdown.split("\n");
      const text = lines.slice(startLine, endLine + 1).join("\n");
      setPendingSelection({ text, startLine, endLine });
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [getLineFromY, isDragging, isPreviewing, markdown, setPendingSelection]);

  const handleScroll = useCallback(() => {
    const el = textareaRef.current;
    if (el) setScrollTop(el.scrollTop);
  }, []);

  const handleSubmitComment = useCallback(() => {
    if (isPreviewing || !pendingSelection || !commentInput.trim() || !pendingLines) return;

    const centerLine = (pendingLines.start + pendingLines.end) / 2;
    const topPos = paddingTop + centerLine * lineHeight;

    addComment(
      pendingSelection.text,
      pendingSelection.startLine,
      pendingSelection.endLine,
      commentInput.trim(),
      topPos
    );

    setCommentInput("");
    setPendingLines(null);
    setPendingSelection(null);
  }, [
    addComment,
    commentInput,
    isPreviewing,
    lineHeight,
    paddingTop,
    pendingLines,
    pendingSelection,
    setPendingSelection,
  ]);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        handleSubmitComment();
      } else if (e.key === "Escape") {
        setPendingLines(null);
        setPendingSelection(null);
        setCommentInput("");
      }
    },
    [handleSubmitComment, setPendingSelection]
  );

  if (!activeDoc) return null;

  const activeHighlightStyle =
    !isPreviewing && !pendingLines && activeComment
      ? buildRangeStyle({ start: activeComment.startLine, end: activeComment.endLine })
      : null;

  const pendingHighlightStyle = !isPreviewing ? buildRangeStyle(pendingLines) : null;

  const inputTop =
    !isPreviewing && pendingLines && lineHeight > 0
      ? paddingTop + (pendingLines.end + 1) * lineHeight - scrollTop + 8
      : null;

  return (
    <div className="editor-container">
      <div className="editor-main">
        <div className="editor-textarea-wrapper">
          {activeHighlightStyle && (
            <div
              className="line-highlight-overlay line-highlight-overlay--active"
              style={{
                top: activeHighlightStyle.top,
                height: activeHighlightStyle.height,
              }}
            />
          )}

          {pendingHighlightStyle && (
            <div
              className="line-highlight-overlay line-highlight-overlay--pending"
              style={{
                top: pendingHighlightStyle.top,
                height: pendingHighlightStyle.height,
              }}
            />
          )}

          {isPreviewing ? (
            <div className="editor-textarea editor-textarea--preview">
              <GithubDiffView previewMarkdown={previewMarkdown} />
            </div>
          ) : (
            <textarea
              key={activeDocumentId}
              ref={textareaRef}
              className={`editor-textarea${pendingLines ? " line-selecting" : ""}`}
              value={markdown}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onMouseDown={handleMouseDown}
              onScroll={handleScroll}
              spellCheck={false}
              wrap="off"
              placeholder="Type your markdown here..."
            />
          )}

          {!isPreviewing && pendingSelection && inputTop !== null && !isDragging && (
            <div className="comment-input-wrapper" style={{ top: inputTop }}>
              <div className="comment-input-row">
                <input
                  className="comment-input"
                  type="text"
                  placeholder="Add your comment..."
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  autoFocus
                />
                <button
                  className="comment-submit-btn"
                  onClick={handleSubmitComment}
                  disabled={!commentInput.trim()}
                >
                  Send
                </button>
              </div>
            </div>
          )}

          {!isPreviewing && comments.length > 0 && (
            <CommentMarkersOverlay
              comments={comments}
              activeCommentId={activeCommentId}
              scrollTop={scrollTop}
              onSelectComment={handleSelectComment}
            />
          )}
        </div>

        {activeComment && (
          <CommentChatSidebar
            activeComment={activeComment}
            onClearActive={clearActiveComment}
          />
        )}
      </div>
      <Toolbar />
    </div>
  );
}

export function App() {
  const view = useEditorStore((s) => s.view);
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">{view === "prompt" ? <PromptView /> : <EditorView />}</div>
    </div>
  );
}

export default App;
