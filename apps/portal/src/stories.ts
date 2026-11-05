// Story pages: one per app, DRAFT until the owner fills the TODOs.
//
// Facts come only from each app's README, docs and docs/decisions.md. Where a
// fact is unknown, the text is a TODO, which the page shows as a visible
// "To do" note rather than inventing anything. No real figures.

export type Block = string | { todo: string };

export type Story = {
  slug: string;
  /** Must match an app name in packages/ui (src/apps.ts). */
  app: string;
  draft: boolean;
  intro: Block;
  sections: {
    why: Block[];
    what: Block[];
    architecture: Block[];
    decisions: Block[];
    ai: Block[];
    change: Block[];
  };
};

export const sectionTitles: Record<keyof Story["sections"], string> = {
  why: "Why I built it",
  what: "What it does",
  architecture: "Architecture",
  decisions: "Key decisions and trade-offs",
  ai: "How AI helped",
  change: "What I would change",
};

export const stories: Story[] = [
  {
    slug: "arcade",
    app: "Arcade",
    draft: true,
    intro: "A small games hub: quick browser games, each one a single self-contained HTML page.",
    sections: {
      why: [{ todo: "Why Arcade was built, in your own words." }],
      what: [
        "A landing page lists every game as a card, generated from one list in the page. Each game is its own page under games/, with a shared bar that links back to all games.",
        "Games range from canvas arcade games (flap, breakout, endless runners, air hockey) to DOM puzzles and quizzes.",
        "A \"Played N times\" counter on each card is the only thing with a backend, and it is optional: if it is not set up, the games work exactly the same.",
      ],
      architecture: [
        "A static site with no build step: plain HTML, CSS and JavaScript, with each page's style and script inline.",
        "It deploys from GitHub Actions as a Cloudflare Worker with static assets. The Worker also serves the play counter: POST /api/play/<slug> and GET /api/plays, backed by one KV namespace holding all counts.",
        "Arcade uses a committed copy of the shared tokens CSS for its site-links bar, with a check that fails if the copy drifts.",
      ],
      decisions: [
        "The games folder is the play counter's allowlist: a play counts only if /games/<slug>/ exists, so adding a game needs no Worker change.",
        "A basic per-IP rate limit (20 plays a minute) uses the Workers Rate Limiting binding. It is approximate, needs no dashboard setup and works on the free plan. Atomic counters are left out.",
        "No build step, so the shared tokens are a committed copy rather than generated at deploy time; generating it was rejected as a build step in all but name.",
        "Arcade gets the shared site links through a plain script, not the shared React components. The app list in that script is a hand-kept copy of the shared list (still a backlog item).",
      ],
      ai: [
        "Arcade has its own CLAUDE.md with the rules for adding a game (structure, the shared embed script, the play button attribute), so each new game follows the same pattern.",
        { todo: "How AI helped build the games: what worked, what needed fixing." },
      ],
      change: [{ todo: "What you would change about Arcade." }],
    },
  },
  {
    slug: "chalkline",
    app: "Chalkline",
    draft: true,
    intro: "Ideas to diagrams: a responsive web app for architecture diagrams and whiteboard-style models.",
    sections: {
      why: [
        "A personal build project: a diagramming app in the spirit of draw.io, tuned to my own workflow, that works on a phone, a tablet and a laptop.",
        { todo: "Anything else about why: what was missing from existing tools for you." },
      ],
      what: [
        "Boxes, shapes and connectors with notes on every node and edge, colour and style options, groups, swimlanes, layers, alignment and auto-arrange, and a stencil library.",
        "Save and load as JSON that diffs cleanly in git; export to PNG, SVG and PDF.",
        "Optional AI features (generate, refine, suggest notes) with an AI change log of what was applied and why. You bring your own key.",
      ],
      architecture: [
        "A static front end with no backend: Vite, React and TypeScript, React Flow for the canvas, Zustand for state and a Zod schema as the single source of truth for the diagram.",
        "Autosave to browser storage, with JSON export as the backup and migration path, because browser storage is per site.",
        "Deployed as a Cloudflare Worker with static assets at chalkline.krishnabuilds.dev.",
      ],
      decisions: [
        "Every schema change bumps the schema version with a tested migration, so old diagrams keep loading. Unknown shape types load, draw as rectangles and save unchanged.",
        "Export is built in-house with no new dependencies: SVG from the diagram data, PNG rasterised from it and PDF from a small hand-written writer.",
        "Colours are stored as hex or as theme tokens, so diagrams follow light and dark.",
        "Chalkline keeps its own palette and radii and takes only the type scale, spacing and accent from the shared tokens. Its theme is the shared krishnabuilds.dev setting.",
      ],
      ai: [
        "Built with Claude Code, working one phase at a time on its own branch, with planning and reviews in separate chats.",
        { todo: "Specific examples of where AI helped and where it needed correcting." },
      ],
      change: [{ todo: "What you would change about Chalkline." }],
    },
  },
  {
    slug: "stickyard",
    app: "Stickyard",
    draft: true,
    intro: "A real-time collaborative sticky-note board for workshops and retros. Join by link and a typed name, no accounts.",
    sections: {
      why: [
        "A personal learning project: to build a collaboration app properly, with rooms, presence, sync, reconnect, persistence and abuse limits.",
        "The idea is the retro and workshop board you can start in seconds with no sign-in, plus facilitation.",
      ],
      what: [
        "Sticky notes, frames, shapes, arrows and groups on a large board, with templates, chat and everyone's pointers.",
        "Facilitation for the host: a timer, locking the board, anonymous dot voting and a silent brainstorm revealed all at once.",
        "Export as a PNG, Markdown or a board file, and optional AI features that use your own key.",
      ],
      architecture: [
        "A Vite, React and TypeScript front end on a Cloudflare Worker with static assets, and a relay Worker with one SQLite-backed Durable Object per room using the WebSocket Hibernation API.",
        "Zod message schemas in a shared package are used by both sides, with a protocol version in the join handshake.",
        "Both Workers deploy from one GitHub Actions workflow.",
      ],
      decisions: [
        "Server-authoritative, last-write-wins sync with optimistic client updates. The server assigns ids and colours and never trusts what a client claims.",
        "Creating a room needs a passcode held as a Worker secret; joining needs only the link. Room codes are long, random and signed, and there is a kill switch that stops new rooms without a redeploy.",
        "Every inbound message is size-capped, safely parsed and validated. Rooms expire after a set idle time.",
        "AI is bring your own key: the browser calls the AI provider directly, so there is no AI server and nothing AI-related goes over the WebSocket.",
      ],
      ai: [
        "Built with Claude Code one slice at a time, with each slice reviewed before the next. Claude Code sometimes built more than asked, so every slice is reviewed against its scope.",
        { todo: "Specific examples of where AI helped and where it needed correcting." },
      ],
      change: [{ todo: "What you would change about Stickyard." }],
    },
  },
  {
    slug: "sumyard",
    app: "Sumyard",
    draft: true,
    intro: "Personal UK finance calculators in one clean, ad-free web app. Illustrative, not financial advice.",
    sections: {
      why: [
        "Built for my own use: a set of UK finance calculators in one place, without ads or tracking.",
        { todo: "Anything else about why you built it." },
      ],
      what: [
        "Calculators for take-home pay and pension contributions, compound interest, car decisions (keep, buy or finance), a household budget, mortgage overpayments and where the next lump sum might go.",
        "Scenarios can be saved, compared, exported and backed up. Every page shows its assumptions and the illustrative-not-advice note.",
      ],
      architecture: [
        "A static, client-side-only site: Vite, React and TypeScript with Tailwind over one tokens file. No backend, accounts, analytics or network requests.",
        "Each calculator is a pure, unit-tested function; pages are built from shared components such as the sticky result and hand-rolled SVG charts with table fallbacks.",
        "Deployed as a Cloudflare Worker with static assets at sumyard.krishnabuilds.dev.",
      ],
      decisions: [
        "Tax rules live only in a per-tax-year config, and every value carries its GOV.UK source and the date it was checked. A calculator refuses to show results if a value it needs is unverified.",
        "Money is held as whole pence with explicit rounding, never floating point.",
        "The build scans its output for external URLs and fails on any that are not allowed.",
        "No real personal financial data goes in the public repo; examples are generic.",
      ],
      ai: [
        "Built with Claude Code one part at a time, with tests written first for calculator and config work.",
        "The project's own rules forbid stating a tax figure from memory: every figure must come from a checked source.",
        { todo: "Specific examples of where AI helped and where it needed correcting." },
      ],
      change: [{ todo: "What you would change about Sumyard." }],
    },
  },
];

export function storyFor(app: string): Story | undefined {
  return stories.find((story) => story.app === app);
}
