import { describe, expect, it } from "bun:test";
import {
  buildDiffPreview,
  buildPreviewMarkdown,
  parsePreviewMarkdown,
  replaceFirstExact,
} from "./diffPreview";

describe("replaceFirstExact", () => {
  it("replaces only the first exact match", () => {
    const source = "alpha beta alpha";
    const result = replaceFirstExact(source, "alpha", "omega");

    expect(result.found).toBe(true);
    expect(result.result).toBe("omega beta alpha");
  });

  it("does not replace when old string is missing", () => {
    const source = "alpha beta";
    const result = replaceFirstExact(source, "gamma", "omega");

    expect(result.found).toBe(false);
    expect(result.result).toBe(source);
  });
});

describe("buildDiffPreview", () => {
  it("builds unified hunks with stable line numbers", () => {
    const oldMarkdown = "line one\nline two\nline three\n";
    const newMarkdown = "line one\nline 2\nline three\n";

    const preview = buildDiffPreview(oldMarkdown, newMarkdown);

    expect(preview.hunks.length).toBeGreaterThan(0);
    const allLines = preview.hunks.flatMap((h) => h.lines);
    const delLine = allLines.find((line) => line.kind === "del");
    const addLine = allLines.find((line) => line.kind === "add");

    expect(delLine?.oldNo).toBe(2);
    expect(delLine?.newNo).toBeNull();
    expect(addLine?.oldNo).toBeNull();
    expect(addLine?.newNo).toBe(2);
  });

  it("adds basic word-level highlights for adjacent delete/add lines", () => {
    const oldMarkdown = "status: draft\n";
    const newMarkdown = "status: final\n";

    const preview = buildDiffPreview(oldMarkdown, newMarkdown);
    const allLines = preview.hunks.flatMap((h) => h.lines);
    const delLine = allLines.find((line) => line.kind === "del");
    const addLine = allLines.find((line) => line.kind === "add");

    expect(delLine?.oldTokens?.some((span) => span.changed)).toBe(true);
    expect(addLine?.newTokens?.some((span) => span.changed)).toBe(true);
  });

  it("builds preview markdown that preserves deleted and added line text", () => {
    const oldMarkdown = "alpha\nbeta\n";
    const newMarkdown = "alpha\ngamma\n";

    const diffPreview = buildDiffPreview(oldMarkdown, newMarkdown);
    const previewMarkdown = buildPreviewMarkdown(diffPreview);
    const previewLines = parsePreviewMarkdown(previewMarkdown);

    expect(previewLines.some((line) => line.kind === "del" && line.text === "beta")).toBe(true);
    expect(previewLines.some((line) => line.kind === "add" && line.text === "gamma")).toBe(true);
  });
});
