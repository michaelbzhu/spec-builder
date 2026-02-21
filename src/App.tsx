import { useCallback, useRef, useState } from "react";
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

export function App() {
  const markdown = useEditorStore((s) => s.markdown);
  const setMarkdown = useEditorStore((s) => s.setMarkdown);
  const pendingSelection = useEditorStore((s) => s.pendingSelection);
  const setPendingSelection = useEditorStore((s) => s.setPendingSelection);
  const addComment = useEditorStore((s) => s.addComment);
  const comments = useEditorStore((s) => s.comments);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [commentInput, setCommentInput] = useState("");
  const [showPopover, setShowPopover] = useState(false);
  const [buttonTop, setButtonTop] = useState<number | null>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setMarkdown(e.target.value);
    },
    [setMarkdown]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
    [setMarkdown]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLTextAreaElement>) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      if (start !== end) {
        const text = textarea.value.substring(start, end);
        setPendingSelection({ text, start, end });
        const textareaRect = textarea.getBoundingClientRect();
        const relativeY = e.clientY - textareaRect.top + textarea.scrollTop;
        setButtonTop(relativeY);
        setShowPopover(false);
      } else {
        setPendingSelection(null);
        setShowPopover(false);
        setButtonTop(null);
      }
    },
    [setPendingSelection]
  );

  const handleKeyUp = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (start === end) {
      setPendingSelection(null);
      setShowPopover(false);
      setButtonTop(null);
    }
  }, [setPendingSelection]);

  const handleCommentClick = useCallback(() => {
    setShowPopover(true);
  }, []);

  const handleSubmitComment = useCallback(() => {
    if (!pendingSelection || !commentInput.trim() || buttonTop === null) return;
    addComment(
      pendingSelection.text,
      pendingSelection.start,
      pendingSelection.end,
      commentInput.trim(),
      buttonTop
    );
    setCommentInput("");
    setShowPopover(false);
    setButtonTop(null);
    setPendingSelection(null);
  }, [pendingSelection, commentInput, buttonTop, addComment, setPendingSelection]);

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

  const handleScroll = useCallback(() => {
    // Close popover on scroll to avoid misalignment
    if (showPopover) {
      setShowPopover(false);
    }
  }, [showPopover]);

  return (
    <div className="editor-container">
      <header className="toolbar">
        <h1 className="toolbar-title">Markdown Editor</h1>
      </header>

      <div className="editor-main">
        <div className="editor-textarea-wrapper">
          <textarea
            ref={textareaRef}
            className="editor-textarea"
            value={markdown}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onMouseUp={handleMouseUp}
            onKeyUp={handleKeyUp}
            onScroll={handleScroll}
            spellCheck={false}
            placeholder="Type your markdown here..."
          />
          {pendingSelection && buttonTop !== null && (
            <div className="comment-trigger" style={{ top: buttonTop - (textareaRef.current?.scrollTop ?? 0) }}>
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

export default App;
