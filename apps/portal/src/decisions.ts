// The decision log, read from docs/decisions.md at build time.
//
// Vite inlines the file as a string (`?raw`), so the page needs no request
// and no new dependency, and every deploy carries the log as it was merged.
// The deploy-portal workflow lists docs/decisions.md in its paths, so a new
// decision redeploys the Portal.

import source from "../../../docs/decisions.md?raw";

export type Tag = "Platform" | "Design system" | "Spikes";

export const tags: Tag[] = ["Platform", "Design system", "Spikes"];

export type Decision = {
  date: string;
  title: string;
  tag: Tag;
  /** The entry's Markdown body: the "why". */
  body: string;
};

/**
 * The filter tag for a decision, from its title only (titles are short and
 * written to say what the decision is about):
 * - Spikes: the work that spikes fed (a spike, Stonks or D1).
 * - Design system: tokens, theme, colour, fonts, branding, the shared header
 *   and site links, the ui package and how the Portal's pages look.
 * - Platform: everything else (repo, tooling, CI, deploys, hosting, security).
 * The first match wins, in that order.
 */
export function tagFor(title: string): Tag {
  if (/spike|stonks|\bD1\b/i.test(title)) return "Spikes";
  if (
    /token|theme|colou?r|accent|font|brand|design|site links|header|\bui\b|landing|\bstory\b|how this is built/i.test(
      title,
    )
  ) {
    return "Design system";
  }
  return "Platform";
}

/** Splits the log on its "## YYYY-MM-DD — Title" headings, newest first. */
export function parseDecisions(markdown: string): Decision[] {
  return markdown
    .split(/^## /m)
    .slice(1)
    .flatMap((chunk) => {
      const [heading = "", ...rest] = chunk.split("\n");
      const match = heading.match(/^(\d{4}-\d{2}-\d{2})\s+—\s+(.+)$/);
      if (!match) return [];
      const [, date = "", title = ""] = match;
      return [{ date, title, tag: tagFor(title), body: rest.join("\n").trim() }];
    })
    .reverse();
}

export const decisions = parseDecisions(source);
