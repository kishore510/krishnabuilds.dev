import type { ReactNode } from "react";

// A tiny renderer for the decision log's Markdown: paragraphs, "- " lists,
// `code` and **bold**. It builds React elements, never HTML strings.

export function inline(text: string): ReactNode[] {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/).map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={i}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export function Markdown({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n\s*\n/).map((block, i) => {
        const lines = block.split("\n").filter((line) => line.trim() !== "");
        if (lines.length > 0 && lines.every((line) => line.startsWith("- "))) {
          return (
            <ul key={i}>
              {lines.map((line, j) => (
                <li key={j}>{inline(line.slice(2))}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{inline(lines.join(" "))}</p>;
      })}
    </>
  );
}
