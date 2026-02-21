import { diffWordsWithSpace, structuredPatch } from "diff";

export interface DiffTokenSpan {
  text: string;
  changed: boolean;
}

export interface DiffLine {
  kind: "context" | "add" | "del";
  oldNo: number | null;
  newNo: number | null;
  text: string;
  oldTokens?: DiffTokenSpan[];
  newTokens?: DiffTokenSpan[];
}

export interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

export interface DiffPreview {
  oldMarkdown: string;
  newMarkdown: string;
  oldFileLabel?: string;
  newFileLabel?: string;
  hunks: DiffHunk[];
}

export interface PreviewMarkdownLine {
  kind: "context" | "add" | "del";
  text: string;
}

const PREVIEW_DEL_PREFIX = "<<<PREVIEW_DEL>>>";
const PREVIEW_ADD_PREFIX = "<<<PREVIEW_ADD>>>";
const PREVIEW_ESC_PREFIX = "<<<PREVIEW_ESC>>>";

export function replaceFirstExact(
  source: string,
  oldString: string,
  newString: string
): { found: boolean; result: string } {
  if (!oldString) {
    return { found: false, result: source };
  }

  const index = source.indexOf(oldString);
  if (index === -1) {
    return { found: false, result: source };
  }

  return {
    found: true,
    result: source.slice(0, index) + newString + source.slice(index + oldString.length),
  };
}

function buildDiffTokenSpans(
  oldText: string,
  newText: string
): { oldTokens: DiffTokenSpan[]; newTokens: DiffTokenSpan[] } {
  const parts = diffWordsWithSpace(oldText, newText);
  const oldTokens: DiffTokenSpan[] = [];
  const newTokens: DiffTokenSpan[] = [];

  for (const part of parts) {
    if (!part.added) {
      oldTokens.push({ text: part.value, changed: Boolean(part.removed) });
    }
    if (!part.removed) {
      newTokens.push({ text: part.value, changed: Boolean(part.added) });
    }
  }

  return { oldTokens, newTokens };
}

function addIntraLineHighlights(lines: DiffLine[]): DiffLine[] {
  const output = lines.map((line) => ({ ...line }));
  let i = 0;

  while (i < output.length) {
    if (output[i]?.kind !== "del") {
      i += 1;
      continue;
    }

    const delStart = i;
    while (i < output.length && output[i]?.kind === "del") {
      i += 1;
    }
    const addStart = i;
    while (i < output.length && output[i]?.kind === "add") {
      i += 1;
    }

    const delCount = addStart - delStart;
    const addCount = i - addStart;
    const pairCount = Math.min(delCount, addCount);

    for (let j = 0; j < pairCount; j += 1) {
      const delLine = output[delStart + j];
      const addLine = output[addStart + j];
      if (!delLine || !addLine) continue;

      const spans = buildDiffTokenSpans(delLine.text, addLine.text);
      delLine.oldTokens = spans.oldTokens;
      addLine.newTokens = spans.newTokens;
    }
  }

  return output;
}

export function buildDiffPreview(
  oldMarkdown: string,
  newMarkdown: string,
  oldFileLabel = "a/document.md",
  newFileLabel = "b/document.md"
): DiffPreview {
  // Keep full document visible in preview by expanding unified diff context.
  const fullContext = Math.max(
    oldMarkdown.split("\n").length,
    newMarkdown.split("\n").length
  ) + 1;

  const patch = structuredPatch(
    oldFileLabel,
    newFileLabel,
    oldMarkdown,
    newMarkdown,
    "",
    "",
    { context: fullContext }
  );

  const hunks: DiffHunk[] = patch.hunks.map((hunk) => {
    const lines: DiffLine[] = [];
    let oldNo = hunk.oldStart;
    let newNo = hunk.newStart;

    for (const rawLine of hunk.lines) {
      if (!rawLine) continue;
      const marker = rawLine[0];
      const text = rawLine.slice(1);

      if (marker === " ") {
        lines.push({ kind: "context", oldNo, newNo, text });
        oldNo += 1;
        newNo += 1;
        continue;
      }
      if (marker === "-") {
        lines.push({ kind: "del", oldNo, newNo: null, text });
        oldNo += 1;
        continue;
      }
      if (marker === "+") {
        lines.push({ kind: "add", oldNo: null, newNo, text });
        newNo += 1;
      }
    }

    return {
      header: `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`,
      lines: addIntraLineHighlights(lines),
    };
  });

  return {
    oldMarkdown,
    newMarkdown,
    oldFileLabel,
    newFileLabel,
    hunks,
  };
}

export function buildPreviewMarkdown(diffPreview: DiffPreview): string {
  const lines: string[] = [];

  for (const hunk of diffPreview.hunks) {
    for (const line of hunk.lines) {
      if (line.kind === "del") {
        lines.push(`${PREVIEW_DEL_PREFIX}${line.text}`);
        continue;
      }

      if (line.kind === "add") {
        lines.push(`${PREVIEW_ADD_PREFIX}${line.text}`);
        continue;
      }

      if (
        line.text.startsWith(PREVIEW_DEL_PREFIX) ||
        line.text.startsWith(PREVIEW_ADD_PREFIX) ||
        line.text.startsWith(PREVIEW_ESC_PREFIX)
      ) {
        lines.push(`${PREVIEW_ESC_PREFIX}${line.text}`);
      } else {
        lines.push(line.text);
      }
    }
  }

  return lines.join("\n");
}

export function parsePreviewMarkdown(previewMarkdown: string): PreviewMarkdownLine[] {
  return previewMarkdown.split("\n").map((line) => {
    if (line.startsWith(PREVIEW_DEL_PREFIX)) {
      return { kind: "del" as const, text: line.slice(PREVIEW_DEL_PREFIX.length) };
    }

    if (line.startsWith(PREVIEW_ADD_PREFIX)) {
      return { kind: "add" as const, text: line.slice(PREVIEW_ADD_PREFIX.length) };
    }

    if (line.startsWith(PREVIEW_ESC_PREFIX)) {
      return { kind: "context" as const, text: line.slice(PREVIEW_ESC_PREFIX.length) };
    }

    return { kind: "context" as const, text: line };
  });
}
