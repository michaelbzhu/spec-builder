import { useState, useCallback, useRef, useEffect } from "react";
import { marked } from "marked";

import "./index.css";

const DEFAULT_MARKDOWN = `# Markdown Editor

Welcome to the **Markdown Editor**! Start typing on the left to see a live preview on the right.

## Features

- **Live preview** as you type
- Supports all standard Markdown syntax
- Clean, minimal interface

## Syntax Examples

### Text Formatting

*Italic*, **bold**, and \`inline code\`.

### Links & Images

[Visit GitHub](https://github.com)

### Code Blocks

\`\`\`javascript
function greet(name) {
  return \\\`Hello, \\\${name}!\\\`;
}
\`\`\`

### Blockquotes

> "The best way to predict the future is to invent it."
> — Alan Kay

### Lists

1. First item
2. Second item
3. Third item

---

Happy writing!
`;

marked.setOptions({
  breaks: true,
  gfm: true,
});

export function App() {
  const [markdown, setMarkdown] = useState(DEFAULT_MARKDOWN);
  const [html, setHtml] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setHtml(marked.parse(markdown) as string);
  }, [markdown]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setMarkdown(e.target.value);
    },
    []
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
    []
  );

  return (
    <div className="editor-container">
      <header className="toolbar">
        <h1 className="toolbar-title">Markdown Editor</h1>
      </header>
      <div className="panels">
        <div className="panel editor-panel">
          <div className="panel-header">Edit</div>
          <textarea
            ref={textareaRef}
            className="editor-textarea"
            value={markdown}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            placeholder="Type your markdown here..."
          />
        </div>
        <div className="panel preview-panel">
          <div className="panel-header">Preview</div>
          <div
            className="preview-content"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
