import { useEditorStore, type Comment } from "./store";

function CommentCard({ comment }: { comment: Comment }) {
  return (
    <div className="comment-card">
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

export function CommentsPanel() {
  const comments = useEditorStore((s) => s.comments);

  return (
    <div className="comments-panel">
      {comments.length === 0 ? (
        <div className="comments-empty">
          Highlight text and add a comment to get started
        </div>
      ) : (
        comments.map((c) => <CommentCard key={c.id} comment={c} />)
      )}
    </div>
  );
}
