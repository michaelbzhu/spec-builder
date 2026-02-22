import hljs from "highlight.js";
import { Marked } from "marked";
import { markedHighlight } from "marked-highlight";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const commentMarkdown = new Marked(
  markedHighlight({
    langPrefix: "hljs language-",
    emptyLangClass: "hljs",
    highlight(code, language) {
      try {
        const normalizedLanguage = language.trim().toLowerCase();
        if (normalizedLanguage && hljs.getLanguage(normalizedLanguage)) {
          return hljs.highlight(code, { language: normalizedLanguage, ignoreIllegals: true }).value;
        }
        return hljs.highlightAuto(code).value;
      } catch {
        return escapeHtml(code);
      }
    },
  }),
  {
    renderer: {
      html(token) {
        return escapeHtml(token.text);
      },
    },
  },
);

commentMarkdown.setOptions({
  async: false,
  gfm: true,
  breaks: true,
});

export function renderCommentMarkdown(markdown: string): string {
  const parsed = commentMarkdown.parse(markdown, { async: false });
  return typeof parsed === "string" ? parsed : "";
}

function highlightMarkdownSource(text: string): string {
  try {
    let underscorePlaceholder = "CODXUNDERSCOREPLACEHOLDER";
    while (text.includes(underscorePlaceholder)) {
      underscorePlaceholder += "X";
    }

    const neutralizedText = text.replaceAll("_", underscorePlaceholder);
    const highlighted = hljs.highlight(neutralizedText, { language: "markdown", ignoreIllegals: true }).value;
    return highlighted.replaceAll(underscorePlaceholder, "_");
  } catch {
    return escapeHtml(text);
  }
}

function highlightCodeFence(text: string, language: string): string {
  try {
    const normalizedLanguage = language.trim().toLowerCase();
    if (normalizedLanguage && hljs.getLanguage(normalizedLanguage)) {
      return hljs.highlight(text, { language: normalizedLanguage, ignoreIllegals: true }).value;
    }
    return hljs.highlightAuto(text).value;
  } catch {
    return escapeHtml(text);
  }
}

function isFenceCloseLine(line: string, fenceChar: "`" | "~", minLength: number): boolean {
  const trimmed = line.trim();
  if (trimmed.length < minLength || trimmed[0] !== fenceChar) return false;

  for (const ch of trimmed) {
    if (ch !== fenceChar) return false;
  }

  return true;
}

export function renderEditorMarkdown(markdown: string): string {
  if (markdown.length === 0) return "";

  const lines = markdown.split("\n");
  const renderedLines: string[] = [];
  let proseStart = 0;
  let index = 0;

  const flushProse = (endExclusive: number) => {
    if (endExclusive <= proseStart) return;
    const proseText = lines.slice(proseStart, endExclusive).join("\n");
    renderedLines.push(...highlightMarkdownSource(proseText).split("\n"));
  };

  while (index < lines.length) {
    const line = lines[index];
    const openFenceMatch = line.match(/^\s*(`{3,}|~{3,})(.*)$/);
    if (!openFenceMatch) {
      index += 1;
      continue;
    }

    flushProse(index);

    const fenceMarker = openFenceMatch[1];
    const fenceChar = fenceMarker[0] as "`" | "~";
    const fenceLength = fenceMarker.length;
    const infoString = openFenceMatch[2].trim();
    const language = infoString.length > 0 ? infoString.split(/\s+/, 1)[0].toLowerCase() : "";

    renderedLines.push(`<span class="hljs-meta">${escapeHtml(line)}</span>`);
    index += 1;

    const codeStart = index;
    while (index < lines.length && !isFenceCloseLine(lines[index], fenceChar, fenceLength)) {
      index += 1;
    }

    const codeText = lines.slice(codeStart, index).join("\n");
    if (codeText.length > 0) {
      renderedLines.push(...highlightCodeFence(codeText, language).split("\n"));
    }

    if (index < lines.length) {
      renderedLines.push(`<span class="hljs-meta">${escapeHtml(lines[index])}</span>`);
      index += 1;
    }

    proseStart = index;
  }

  flushProse(lines.length);

  return renderedLines.join("\n");
}
