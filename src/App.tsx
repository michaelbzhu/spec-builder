import { useCallback, useRef, useState } from "react";
import { useEditorStore } from "./store";
import { CommentsPanel } from "./CommentsPanel";

import "./index.css";

export function App() {
  const markdown = useEditorStore((s) => s.markdown);
  const setMarkdown = useEditorStore((s) => s.setMarkdown);
  const pendingSelection = useEditorStore((s) => s.pendingSelection);
  const setPendingSelection = useEditorStore((s) => s.setPendingSelection);
  const addComment = useEditorStore((s) => s.addComment);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editorPanelRef = useRef<HTMLDivElement>(null);
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
        // Position relative to the textarea element itself
        const textareaRect = textarea.getBoundingClientRect();
        const relativeY = e.clientY - textareaRect.top;
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
    if (!pendingSelection || !commentInput.trim()) return;
    addComment(
      pendingSelection.text,
      pendingSelection.start,
      pendingSelection.end,
      commentInput.trim()
    );
    setCommentInput("");
    setShowPopover(false);
    setButtonTop(null);
    setPendingSelection(null);
  }, [pendingSelection, commentInput, addComment, setPendingSelection]);

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

  return (
    <div className="editor-container">
      <header className="toolbar">
        <h1 className="toolbar-title">Markdown Editor</h1>
      </header>

      <div className="panels">
        <div className="panel editor-panel">
          <div className="panel-header">Edit</div>
          <div className="editor-textarea-wrapper" ref={editorPanelRef}>
            <textarea
              ref={textareaRef}
              className="editor-textarea"
              value={markdown}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onMouseUp={handleMouseUp}
              onKeyUp={handleKeyUp}
              spellCheck={false}
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
        </div>
        <div className="panel">
          <div className="panel-header">Comments</div>
          <CommentsPanel />
        </div>
      </div>
    </div>
  );
}

export default App;
