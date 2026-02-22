import { describe, expect, it } from "bun:test";
import { renderCommentMarkdown, renderEditorMarkdown } from "./markdown";

describe("renderCommentMarkdown", () => {
  it("highlights explicit-language code fences", () => {
    const markdown = ["```js", "const answer = 42;", "```"].join("\n");
    const html = renderCommentMarkdown(markdown);

    expect(html).toContain('<code class="hljs language-js">');
    expect(html).toContain("hljs-keyword");
  });

  it("handles unknown code fence languages safely", () => {
    const markdown = ["```madeuplang", "foo < bar", "```"].join("\n");
    const html = renderCommentMarkdown(markdown);

    expect(html).toContain('<code class="hljs language-madeuplang">');
    expect(html).toContain("foo");
    expect(html).toContain("&lt;");
  });

  it("handles code fences without a language", () => {
    const markdown = ["```", "alpha()", "```"].join("\n");
    const html = renderCommentMarkdown(markdown);

    expect(html).toContain('<code class="hljs">');
    expect(html).toContain("alpha");
  });

  it("escapes raw html in markdown input", () => {
    const html = renderCommentMarkdown('<script>alert("x")</script>');

    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(html).not.toContain("<script>");
  });
});

describe("renderEditorMarkdown", () => {
  it("highlights markdown syntax outside code fences", () => {
    const markdown = ["# Heading", "", "- item", "", "**bold** text"].join("\n");
    const html = renderEditorMarkdown(markdown);

    expect(html).toContain("hljs-section");
    expect(html).toContain("hljs-bullet");
    expect(html).toContain("hljs-strong");
  });

  it("highlights fenced code blocks using declared language", () => {
    const markdown = ["```ts", "const answer: number = 42;", "```"].join("\n");
    const html = renderEditorMarkdown(markdown);

    expect(html).toContain("hljs-meta");
    expect(html).toContain("hljs-keyword");
  });

  it("falls back safely for unknown fence languages", () => {
    const markdown = ["```madeuplang", "foo < bar", "```"].join("\n");
    const html = renderEditorMarkdown(markdown);

    expect(html).toContain("hljs-meta");
    expect(html).toContain("&lt;");
  });

  it("does not treat identifier underscores as markdown emphasis", () => {
    const html = renderEditorMarkdown("CONSTANT_NAME");

    expect(html).toContain("CONSTANT_NAME");
    expect(html).not.toContain("hljs-emphasis");
  });

  it("does not let unmatched underscores swallow following markdown syntax", () => {
    const markdown = ["CONSTANT_NAME and more", "next line", "# heading"].join("\n");
    const html = renderEditorMarkdown(markdown);

    expect(html).toContain("CONSTANT_NAME");
    expect(html).toContain("hljs-section");
  });

  it("keeps asterisk emphasis highlighting", () => {
    const html = renderEditorMarkdown("*italic*");

    expect(html).toContain("hljs-emphasis");
  });
});
