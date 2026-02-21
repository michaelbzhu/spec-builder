import { useCallback, useEffect, useRef, useState } from "react";
import { useEditorStore, type Comment } from "./store";

import "./index.css";

// Parse preview markdown and render with highlights
function PreviewContent({ markdown }: { markdown: string }) {
  // Split by markers and render with appropriate styling
  const parts: Array<{ type: "normal" | "remove" | "add"; content: string }> = [];
  
  let remaining = markdown;
  while (remaining.length > 0) {
    const removeStart = remaining.indexOf("<<<REMOVE>>>");
    const addStart = remaining.indexOf("<<<ADD>>>");
    
    if (removeStart === -1 && addStart === -1) {
      // No more markers
      parts.push({ type: "normal", content: remaining });
      break;
    }
    
    const nextMarker = removeStart !== -1 && addStart !== -1
      ? Math.min(removeStart, addStart)
      : removeStart !== -1
      ? removeStart
      : addStart;
    
    if (nextMarker > 0) {
      parts.push({ type: "normal", content: remaining.slice(0, nextMarker) });
    }
    
    if (remaining.slice(nextMarker).startsWith("<<<REMOVE>>>")) {
      const endIdx = remaining.indexOf("<<<END>>>", nextMarker);
      if (endIdx === -1) {
        parts.push({ type: "normal", content: remaining.slice(nextMarker) });
        break;
      }
      const content = remaining.slice(nextMarker + 12, endIdx); // 12 = len("<<<REMOVE>>>")
      parts.push({ type: "remove", content });
      remaining = remaining.slice(endIdx + 9); // 9 = len("<<<END>>>")
    } else {
      const endIdx = remaining.indexOf("<<<END>>>", nextMarker);
      if (endIdx === -1) {
        parts.push({ type: "normal", content: remaining.slice(nextMarker) });
        break;
      }
      const content = remaining.slice(nextMarker + 9, endIdx); // 9 = len("<<<ADD>>>")
      parts.push({ type: "add", content });
      remaining = remaining.slice(endIdx + 9);
    }
  }
  
  return (
    <>
      {parts.map((part, i) => {
        if (part.type === "normal") {
          return <span key={i}>{part.content}</span>;
        }
        if (part.type === "remove") {
          return (
            <span key={i} className="preview-remove">
              {part.content}
            </span>
          );
        }
        return (
          <span key={i} className="preview-add">
            {part.content}
          </span>
        );
      })}
    </>
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
          <button
            className="edit-btn edit-btn-accept"
            onClick={() => applyEdit(comment.id)}
          >
            Accept
          </button>
          <button
            className="edit-btn edit-btn-reject"
            onClick={() => rejectEdit(comment.id)}
          >
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

function Toolbar() {
  const activeDoc = useEditorStore((s) =>
    s.documents.find((d) => d.id === s.activeDocumentId)
  );
  const showComments = useEditorStore((s) => s.showComments);
  const toggleComments = useEditorStore((s) => s.toggleComments);

  const charCount = activeDoc?.markdown.length ?? 0;
  const commentCount = activeDoc?.comments.length ?? 0;

  return (
    <div className="editor-toolbar">
      <div className="toolbar-left">
        <span className="toolbar-char-count">{charCount} chars</span>
      </div>
      <div className="toolbar-right">
        <button
          className={`toolbar-btn toolbar-comments-btn ${showComments ? "active" : ""}`}
          onClick={toggleComments}
          title="Toggle comments"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <span>{commentCount}</span>
        </button>
      </div>
    </div>
  );
}

function CommentCard({ comment }: { comment: Comment }) {
  return (
    <div
      className="comment-card"
      style={{ top: comment.topPosition }}
    >
      <div className="comment-selected-text">"{comment.selectedText}"</div>
      <div className="comment-user">{comment.userComment}</div>
      {comment.loading ? (
        <div className="comment-loading">
          <span className="loading-dot" />
          <span className="loading-dot" />
          <span className="loading-dot" />
        </div>
      ) : (
        <>
          <div className="comment-llm">{comment.llmResponse}</div>
          {comment.editSuggestion && <EditSuggestionCard comment={comment} />}
        </>
      )}
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
  const activeDoc = useEditorStore((s) =>
    s.documents.find((d) => d.id === s.activeDocumentId)
  );
  const setMarkdown = useEditorStore((s) => s.setMarkdown);
  const pendingSelection = useEditorStore((s) => s.pendingSelection);
  const setPendingSelection = useEditorStore((s) => s.setPendingSelection);
  const addComment = useEditorStore((s) => s.addComment);
  const showComments = useEditorStore((s) => s.showComments);

  const markdown = activeDoc?.markdown ?? "";
  const comments = activeDoc?.comments ?? [];
  
  // Check if we're in preview mode
  const isPreviewing = comments.some((c) => c.editSuggestion?.status === "previewing");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [commentInput, setCommentInput] = useState("");

  // Line selection state
  const [lineHeight, setLineHeight] = useState(0);
  const [paddingTop, setPaddingTop] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [selectedLines, setSelectedLines] = useState<{ start: number; end: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const anchorLineRef = useRef<number | null>(null);

  // Measure line height on mount
  useEffect(() => {
    const el = isPreviewing ? previewRef.current : textareaRef.current;
    if (!el) return;
    const style = getComputedStyle(el);
    const fontSize = parseFloat(style.fontSize);
    const lh = parseFloat(style.lineHeight);
    setLineHeight(isNaN(lh) ? fontSize * 1.7 : lh);
    setPaddingTop(parseFloat(style.paddingTop) || 0);
  }, [activeDocumentId, isPreviewing]);

  const getLineFromY = useCallback(
    (clientY: number) => {
      const el = isPreviewing ? previewRef.current : textareaRef.current;
      if (!el || lineHeight === 0) return 0;
      const rect = el.getBoundingClientRect();
      const y = clientY - rect.top + el.scrollTop - paddingTop;
      const totalLines = markdown.split("\n").length;
      return Math.max(0, Math.min(Math.floor(y / lineHeight), totalLines - 1));
    },
    [lineHeight, paddingTop, markdown, isPreviewing]
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
        setSelectedLines(null);
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
      // Only intercept left-click for line selection
      if (e.button !== 0) return;

      // Clear selection if clicking without Cmd (Meta) key
      if (!e.metaKey) {
        setSelectedLines(null);
        setPendingSelection(null);
        return;
      }

      const line = getLineFromY(e.clientY);
      anchorLineRef.current = line;
      setIsDragging(true);
      setSelectedLines({ start: line, end: line });

      // Sync pending selection
      const lines = markdown.split("\n");
      const text = lines[line] ?? "";
      setPendingSelection({ text, startLine: line, endLine: line });

      // Suppress native text selection
      e.preventDefault();
    },
    [getLineFromY, markdown, setPendingSelection]
  );

  // Global mousemove/mouseup for drag selection
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDragging || anchorLineRef.current === null) return;
      const line = getLineFromY(e.clientY);
      const anchor = anchorLineRef.current;
      const startLine = Math.min(anchor, line);
      const endLine = Math.max(anchor, line);
      setSelectedLines({ start: startLine, end: endLine });

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
  }, [getLineFromY, markdown, setPendingSelection, isDragging]);

  const handleScroll = useCallback(() => {
    const el = isPreviewing ? previewRef.current : textareaRef.current;
    if (el) setScrollTop(el.scrollTop);
  }, [isPreviewing]);

  const handleSubmitComment = useCallback(() => {
    if (!pendingSelection || !commentInput.trim() || !selectedLines) return;
    // Position the comment card at the vertical center of the selection
    const centerLine = (selectedLines.start + selectedLines.end) / 2;
    const topPos = paddingTop + centerLine * lineHeight;
    addComment(
      pendingSelection.text,
      pendingSelection.startLine,
      pendingSelection.endLine,
      commentInput.trim(),
      topPos
    );
    setCommentInput("");
    setSelectedLines(null);
    setPendingSelection(null);
  }, [pendingSelection, commentInput, selectedLines, lineHeight, paddingTop, addComment, setPendingSelection]);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        handleSubmitComment();
      } else if (e.key === "Escape") {
        setSelectedLines(null);
        setPendingSelection(null);
        setCommentInput("");
      }
    },
    [handleSubmitComment]
  );

  if (!activeDoc) return null;

  // Compute highlight overlay position
  const highlightStyle = selectedLines && lineHeight > 0
    ? {
        top: paddingTop + selectedLines.start * lineHeight - scrollTop,
        height: (selectedLines.end - selectedLines.start + 1) * lineHeight,
      }
    : null;

  // Compute the input position (bottom of selection, in viewport coords relative to wrapper)
  const inputTop = selectedLines && lineHeight > 0
    ? paddingTop + (selectedLines.end + 1) * lineHeight - scrollTop + 8
    : null;

  return (
    <div className="editor-container">
      <div className="editor-main">
        <div className="editor-textarea-wrapper">
          {highlightStyle && (
            <div
              className="line-highlight-overlay"
              style={{
                top: highlightStyle.top,
                height: highlightStyle.height,
              }}
            />
          )}
          {isPreviewing ? (
            <div
              ref={previewRef}
              className={`editor-preview${selectedLines ? " line-selecting" : ""}`}
              onMouseDown={handleMouseDown}
              onScroll={handleScroll}
            >
              <PreviewContent markdown={markdown} />
            </div>
          ) : (
            <textarea
              key={activeDocumentId}
              ref={textareaRef}
              className={`editor-textarea${selectedLines ? " line-selecting" : ""}`}
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
          {pendingSelection && inputTop !== null && !isDragging && (
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
        </div>

        {showComments && (
          <div className="comments-margin">
            {comments.map((c) => (
              <CommentCard key={c.id} comment={c} />
            ))}
          </div>
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
      <div className="main-content">
        {view === "prompt" ? <PromptView /> : <EditorView />}
      </div>
    </div>
  );
}

export default App;
