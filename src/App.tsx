import { useCallback, useEffect, useRef, useState } from "react";
import { useEditorStore, type Comment } from "./store";

import "./index.css";

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
        <div className="comment-llm">{comment.llmResponse}</div>
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

  const markdown = activeDoc?.markdown ?? "";
  const comments = activeDoc?.comments ?? [];

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [commentInput, setCommentInput] = useState("");
  const [showPopover, setShowPopover] = useState(false);

  // Line selection state
  const [lineHeight, setLineHeight] = useState(0);
  const [paddingTop, setPaddingTop] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [selectedLines, setSelectedLines] = useState<{ start: number; end: number } | null>(null);
  const anchorLineRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);

  // Measure line height on mount
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const style = getComputedStyle(textarea);
    const fontSize = parseFloat(style.fontSize);
    const lh = parseFloat(style.lineHeight);
    setLineHeight(isNaN(lh) ? fontSize * 1.7 : lh);
    setPaddingTop(parseFloat(style.paddingTop) || 0);
  }, [activeDocumentId]);

  const getLineFromY = useCallback(
    (clientY: number) => {
      const textarea = textareaRef.current;
      if (!textarea || lineHeight === 0) return 0;
      const rect = textarea.getBoundingClientRect();
      const y = clientY - rect.top + textarea.scrollTop - paddingTop;
      const totalLines = markdown.split("\n").length;
      return Math.max(0, Math.min(Math.floor(y / lineHeight), totalLines - 1));
    },
    [lineHeight, paddingTop, markdown]
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
        setShowPopover(false);
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
    (e: React.MouseEvent<HTMLTextAreaElement>) => {
      // Only enter line selection mode when Cmd (Meta) is held
      if (!e.metaKey) return;
      // Only intercept left-click for line selection
      if (e.button !== 0) return;

      const line = getLineFromY(e.clientY);
      anchorLineRef.current = line;
      isDraggingRef.current = true;
      setSelectedLines({ start: line, end: line });
      setShowPopover(false);

      // Sync pending selection
      const lines = markdown.split("\n");
      const text = lines[line] ?? "";
      setPendingSelection({ text, startLine: line, endLine: line });

      // Suppress native text selection
      e.preventDefault();
      textareaRef.current?.focus();
    },
    [getLineFromY, markdown, setPendingSelection]
  );

  // Global mousemove/mouseup for drag selection
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || anchorLineRef.current === null) return;
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
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
      }
    };

    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [getLineFromY, markdown, setPendingSelection]);

  const handleScroll = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) setScrollTop(textarea.scrollTop);
  }, []);

  const handleCommentClick = useCallback(() => {
    setShowPopover(true);
  }, []);

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
    setShowPopover(false);
    setSelectedLines(null);
    setPendingSelection(null);
  }, [pendingSelection, commentInput, selectedLines, lineHeight, paddingTop, addComment, setPendingSelection]);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        handleSubmitComment();
      } else if (e.key === "Escape") {
        setShowPopover(false);
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

  // Compute the button position (vertical center of selection, in viewport coords relative to wrapper)
  const buttonTop = selectedLines && lineHeight > 0
    ? paddingTop + ((selectedLines.start + selectedLines.end) / 2) * lineHeight - scrollTop + lineHeight / 2
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
          {pendingSelection && buttonTop !== null && (
            <div className="comment-trigger" style={{ top: buttonTop }}>
              <button
                className="comment-trigger-btn"
                onClick={handleCommentClick}
                title="Add comment"
              >
                +
              </button>
              {showPopover && (
                <div className="comment-popover">
                  <div className="comment-popover-selection">
                    "{pendingSelection.text.length > 60
                      ? pendingSelection.text.slice(0, 60) + "..."
                      : pendingSelection.text}"
                  </div>
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
          )}
        </div>

        <div className="comments-margin">
          {comments.map((c) => (
            <CommentCard key={c.id} comment={c} />
          ))}
        </div>
      </div>
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
