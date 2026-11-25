import { FRAME_STYLE_FIELDS, type Frame, type FrameColor } from "@stickyard/shared";

/*
 * Templates: ready-made sets of frames, as plain data (trusted, written here). A new template is
 * one entry in TEMPLATES; its palette tile follows from it (palette/registry.ts). Applying one
 * goes through RoomSession.applyTemplate, which sends every frame with its size, title and title
 * style in one itemsAdd (protocol v11), so titles are cleaned like any other and the frames appear
 * at once.
 *
 * Template units are board units, with the template's top-left at 0, 0. Every template fits on
 * the board, and every frame is within the frame size limits (test/templates.test.ts).
 *
 * Every template belongs to one group (TEMPLATE_GROUPS). The palette lists each group as its own
 * section headed by the group's name (palette/registry.ts), entries in registry order, so entries
 * here are kept group by group, groups in TEMPLATE_GROUPS order.
 */

/** A frame title's style keys (protocol v10). */
export type FrameTitleStyle = Pick<Frame, (typeof FRAME_STYLE_FIELDS)[number]>;

export interface TemplateFrame {
  /** At most MAX_FRAME_TITLE characters, one line. */
  title: string;
  color: FrameColor;
  x: number;
  y: number;
  w: number;
  h: number;
  style: FrameTitleStyle;
}

/** The template groups, in palette order. `categoryId` is the group's palette category. */
export const TEMPLATE_GROUPS = [
  { label: "Retros", categoryId: "templates-retros" },
  { label: "Planning and facilitation", categoryId: "templates-planning" },
  { label: "Architecture and analysis", categoryId: "templates-architecture" },
  { label: "Strategy and product", categoryId: "templates-strategy" },
] as const;

export type TemplateGroup = (typeof TEMPLATE_GROUPS)[number]["label"];

export interface Template {
  id: string;
  /** The palette section it's listed under. */
  group: TemplateGroup;
  /** The tile's visible label and accessible name. */
  label: string;
  /** Extra words palette search matches. */
  keywords: readonly string[];
  frames: readonly TemplateFrame[];
}

/** Column and heading titles: large, bold, centred. */
const HEADING: FrameTitleStyle = { titleFontSize: "l", titleBold: true, titleItalic: false, titleTextColor: "auto", titleAlign: "center" };
/** The one-line goal above a sprint: the largest size. */
const BANNER: FrameTitleStyle = { ...HEADING, titleFontSize: "xl" };

const COLUMN_W = 480;
const GAP = 40;
/** Columns side by side (three, or four), `h` tall, starting at `y`. */
const columns = (y: number, h: number, cols: readonly [title: string, color: FrameColor][]): TemplateFrame[] =>
  cols.map(([title, color], i) => ({ title, color, x: i * (COLUMN_W + GAP), y, w: COLUMN_W, h, style: HEADING }));

const QUADRANT_W = 600;
const QUADRANT_H = 440;
/** A 2 x 2 matrix: top left, top right, bottom left, bottom right, starting at `y` (0 unless a banner sits above). */
const quadrants = (cells: readonly [title: string, color: FrameColor][], y = 0): TemplateFrame[] =>
  cells.map(([title, color], i) => ({
    title,
    color,
    x: (i % 2) * (QUADRANT_W + GAP),
    y: y + Math.floor(i / 2) * (QUADRANT_H + GAP),
    w: QUADRANT_W,
    h: QUADRANT_H,
    style: HEADING,
  }));

/** The width of three columns and their gaps: a banner over them spans this. */
const THREE_W = 3 * COLUMN_W + 2 * GAP;
/** The same for four columns (Quarterly planning). */
const FOUR_W = 4 * COLUMN_W + 3 * GAP;
/** Five whys: five narrower columns, so a banner over them stays within FRAME_MAX_W (2400). */
const WHY_W = 440;
const FIVE_W = 5 * WHY_W + 4 * GAP;
/** The width of a 2 x 2: a banner over one spans this. */
const TWO_BY_TWO_W = 2 * QUADRANT_W + GAP;
/** A banner's height, and where what sits under it starts. */
const BANNER_H = 200;
const UNDER_BANNER = BANNER_H + GAP;
const banner = (title: string, color: FrameColor, w: number, y = 0): TemplateFrame => ({ title, color, x: 0, y, w, h: BANNER_H, style: BANNER });
/** A row of `cols` column-wide frames, `QUADRANT_H` tall, at `y`, shifted right by `x`. */
const row = (x: number, y: number, cols: readonly [title: string, color: FrameColor][]): TemplateFrame[] =>
  cols.map(([title, color], i) => ({ title, color, x: x + i * (COLUMN_W + GAP), y, w: COLUMN_W, h: QUADRANT_H, style: HEADING }));

export const TEMPLATES: readonly Template[] = [
  /* ── Retros ── */
  {
    id: "retro",
    group: "Retros",
    label: "Retro",
    keywords: ["retro", "retrospective", "went well", "didn't go well", "actions", "review", "columns"],
    frames: columns(0, 720, [
      ["Went well", "green"],
      ["Didn't go well", "pink"],
      ["Actions", "blue"],
    ]),
  },
  {
    id: "start-stop-continue",
    group: "Retros",
    label: "Start Stop Continue",
    keywords: ["start", "stop", "continue", "retro", "retrospective", "feedback", "columns"],
    frames: columns(0, 720, [
      ["Start", "green"],
      ["Stop", "orange"],
      ["Continue", "purple"],
    ]),
  },
  {
    id: "mad-sad-glad",
    group: "Retros",
    label: "Mad Sad Glad",
    keywords: ["mad", "sad", "glad", "feelings", "emotions", "retro", "retrospective", "columns"],
    frames: columns(0, 720, [
      ["Mad", "pink"],
      ["Sad", "blue"],
      ["Glad", "green"],
    ]),
  },
  {
    id: "four-ls",
    group: "Retros",
    label: "4Ls",
    keywords: ["4ls", "four ls", "liked", "learned", "learnt", "lacked", "longed for", "retro", "retrospective", "columns"],
    frames: columns(0, 720, [
      ["Liked", "green"],
      ["Learned", "blue"],
      ["Lacked", "pink"],
      ["Longed for", "purple"],
    ]),
  },
  {
    id: "starfish",
    group: "Retros",
    label: "Starfish",
    keywords: ["starfish", "keep", "less of", "more of", "start", "stop", "retro", "retrospective"],
    frames: [
      ...row(0, 0, [
        ["Keep", "green"],
        ["Less of", "orange"],
        ["More of", "blue"],
      ]),
      // The two below are centred under the three.
      ...row((THREE_W - (2 * COLUMN_W + GAP)) / 2, QUADRANT_H + GAP, [
        ["Start", "purple"],
        ["Stop", "pink"],
      ]),
    ],
  },
  {
    id: "sailboat",
    group: "Retros",
    label: "Sailboat",
    keywords: ["sailboat", "speedboat", "boat", "goal", "wind", "anchors", "rocks", "risks", "retro", "retrospective"],
    frames: [
      { title: "Goal", color: "yellow", x: 0, y: 0, w: THREE_W, h: 200, style: BANNER },
      ...columns(200 + GAP, 560, [
        ["Wind (helps us)", "green"],
        ["Anchors (slow us)", "orange"],
        ["Rocks (risks)", "pink"],
      ]),
    ],
  },
  {
    id: "rose-thorn-bud",
    group: "Retros",
    label: "Rose Thorn Bud",
    keywords: ["rose", "thorn", "bud", "highlights", "challenges", "potential", "retro", "retrospective", "columns"],
    frames: columns(0, 720, [
      ["Rose (went well)", "pink"],
      ["Thorn (was hard)", "orange"],
      ["Bud (could grow)", "green"],
    ]),
  },
  {
    id: "kalm",
    group: "Retros",
    label: "KALM",
    keywords: ["kalm", "keep", "add", "less", "more", "retro", "retrospective", "columns"],
    frames: columns(0, 720, [
      ["Keep", "green"],
      ["Add", "blue"],
      ["Less", "orange"],
      ["More", "purple"],
    ]),
  },
  {
    id: "daki",
    group: "Retros",
    label: "DAKI",
    keywords: ["daki", "drop", "add", "keep", "improve", "retro", "retrospective", "columns"],
    frames: columns(0, 720, [
      ["Drop", "pink"],
      ["Add", "blue"],
      ["Keep", "green"],
      ["Improve", "yellow"],
    ]),
  },
  {
    id: "hot-air-balloon",
    group: "Retros",
    label: "Hot air balloon",
    keywords: ["hot air", "balloon", "sandbags", "storms", "sunny skies", "lifts", "holds", "risks", "retro", "retrospective", "columns"],
    frames: columns(0, 720, [
      ["Hot air (lifts us)", "green"],
      ["Sandbags (hold us down)", "orange"],
      ["Storms (risks ahead)", "pink"],
      ["Sunny skies (what's ahead)", "yellow"],
    ]),
  },
  {
    id: "speedcar",
    group: "Retros",
    label: "Speedcar",
    keywords: ["speedcar", "speed car", "car", "engine", "parachute", "abyss", "risks", "retro", "retrospective", "columns"],
    frames: columns(0, 720, [
      ["Engine (speeds us up)", "green"],
      ["Parachute (slows us)", "orange"],
      ["Abyss (risks ahead)", "pink"],
    ]),
  },
  {
    id: "three-little-pigs",
    group: "Retros",
    label: "Three little pigs",
    keywords: ["three little pigs", "pigs", "straw", "sticks", "bricks", "house", "fragile", "solid", "retro", "retrospective", "columns"],
    frames: columns(0, 720, [
      ["Straw (fragile)", "yellow"],
      ["Sticks (could be stronger)", "orange"],
      ["Bricks (solid)", "green"],
    ]),
  },
  /* ── Planning and facilitation ── */
  {
    id: "sprint-planning",
    group: "Planning and facilitation",
    label: "Sprint planning",
    keywords: ["sprint", "planning", "plan", "goal", "agile", "scrum", "kanban", "backlog", "candidates", "committed", "risks", "questions"],
    frames: [
      { title: "Sprint goal", color: "yellow", x: 0, y: 0, w: THREE_W, h: 200, style: BANNER },
      ...columns(200 + GAP, 560, [
        ["Candidates", "neutral"],
        ["Committed", "green"],
        ["Risks and questions", "orange"],
      ]),
    ],
  },
  {
    id: "impact-effort",
    group: "Planning and facilitation",
    label: "2x2 Impact and Effort",
    keywords: ["2x2", "matrix", "quadrant", "impact", "effort", "prioritise", "prioritize", "priority", "quick wins"],
    frames: quadrants([
      ["Quick wins: high impact, low effort", "green"],
      ["Major projects: high impact, high effort", "blue"],
      ["Fill-ins: low impact, low effort", "yellow"],
      ["Thankless tasks: low impact, high effort", "pink"],
    ]),
  },
  {
    id: "lean-coffee",
    group: "Planning and facilitation",
    label: "Lean coffee",
    keywords: ["lean coffee", "coffee", "agenda", "topics", "to discuss", "discussing", "discussed", "meeting", "kanban", "columns"],
    frames: columns(0, 720, [
      ["To discuss", "yellow"],
      ["Discussing", "blue"],
      ["Discussed", "green"],
    ]),
  },
  {
    id: "kanban",
    group: "Planning and facilitation",
    label: "Kanban",
    keywords: ["kanban", "board", "to do", "todo", "doing", "in progress", "done", "workflow", "tasks", "columns"],
    frames: columns(0, 720, [
      ["To do", "yellow"],
      ["Doing", "blue"],
      ["Done", "green"],
    ]),
  },
  {
    id: "moscow",
    group: "Planning and facilitation",
    label: "MoSCoW",
    keywords: ["moscow", "must", "should", "could", "won't", "wont", "have", "prioritise", "prioritize", "priority", "requirements", "scope", "columns"],
    frames: columns(0, 720, [
      ["Must have", "pink"],
      ["Should have", "orange"],
      ["Could have", "blue"],
      ["Won't have (this time)", "neutral"],
    ]),
  },
  {
    id: "now-next-later",
    group: "Planning and facilitation",
    label: "Now Next Later",
    keywords: ["now", "next", "later", "roadmap", "plan", "planning", "horizons", "columns"],
    frames: columns(0, 720, [
      ["Now", "green"],
      ["Next", "blue"],
      ["Later", "purple"],
    ]),
  },
  {
    id: "eisenhower",
    group: "Planning and facilitation",
    label: "Eisenhower matrix",
    keywords: ["eisenhower", "urgent", "important", "do", "schedule", "delegate", "delete", "2x2", "matrix", "quadrant", "prioritise", "prioritize", "priority"],
    // Rows: important on top, not important below. Columns: urgent on the left, not urgent on the right.
    frames: quadrants([
      ["Do: urgent, important", "green"],
      ["Schedule: not urgent, important", "blue"],
      ["Delegate: urgent, not important", "yellow"],
      ["Delete: not urgent, not important", "pink"],
    ]),
  },
  {
    id: "check-in",
    group: "Planning and facilitation",
    label: "Check-in",
    keywords: ["check-in", "check in", "icebreaker", "ice breaker", "warm up", "start", "meeting", "workshop", "mood", "columns"],
    frames: columns(0, 720, [
      ["How are you arriving?", "yellow"],
      ["What's on your mind?", "blue"],
      ["What do you need today?", "green"],
    ]),
  },
  {
    id: "brainstorm",
    group: "Planning and facilitation",
    label: "Brainstorm",
    keywords: ["brainstorm", "ideas", "ideation", "themes", "affinity", "cluster", "workshop", "challenge", "next steps"],
    frames: [
      banner("The question or challenge", "yellow", THREE_W),
      ...columns(UNDER_BANNER, 560, [
        ["Ideas", "blue"],
        ["Themes", "purple"],
        ["Next steps", "green"],
      ]),
    ],
  },
  {
    id: "parking-lot",
    group: "Planning and facilitation",
    label: "Parking lot",
    keywords: ["parking lot", "parked", "later", "follow up", "off topic", "questions", "meeting", "columns"],
    frames: columns(0, 720, [
      ["Parked", "yellow"],
      ["Follow up (who, when)", "blue"],
      ["Resolved", "green"],
    ]),
  },
  {
    id: "meeting",
    group: "Planning and facilitation",
    label: "Meeting agenda and actions",
    keywords: ["meeting", "agenda", "minutes", "decisions", "actions", "owner", "goal", "notes"],
    frames: [
      banner("Meeting goal", "yellow", THREE_W),
      ...columns(UNDER_BANNER, 560, [
        ["Agenda", "neutral"],
        ["Decisions", "green"],
        ["Actions (who, by when)", "blue"],
      ]),
    ],
  },
  {
    id: "okrs",
    group: "Planning and facilitation",
    label: "OKRs",
    keywords: ["okr", "okrs", "objective", "objectives", "key results", "goals", "targets", "measures", "strategy"],
    frames: [
      banner("Objective", "yellow", THREE_W),
      ...columns(UNDER_BANNER, 560, [
        ["Key result 1", "blue"],
        ["Key result 2", "green"],
        ["Key result 3", "purple"],
      ]),
    ],
  },
  {
    id: "quarterly-planning",
    group: "Planning and facilitation",
    label: "Quarterly planning",
    keywords: ["quarter", "quarterly", "planning", "plan", "pi planning", "months", "goals", "risks", "dependencies", "columns"],
    frames: [
      banner("Quarter goals", "yellow", FOUR_W),
      ...columns(UNDER_BANNER, 560, [
        ["Month 1", "blue"],
        ["Month 2", "green"],
        ["Month 3", "purple"],
        ["Risks and dependencies", "orange"],
      ]),
    ],
  },
  /* ── Architecture and analysis ── */
  {
    id: "swot",
    group: "Architecture and analysis",
    label: "SWOT",
    keywords: ["swot", "strengths", "weaknesses", "opportunities", "threats", "2x2", "matrix", "quadrant", "analysis", "strategy"],
    // Rows: internal on top, external below. Columns: helpful on the left, harmful on the right.
    frames: quadrants([
      ["Strengths: internal, helpful", "green"],
      ["Weaknesses: internal, harmful", "pink"],
      ["Opportunities: external, helpful", "blue"],
      ["Threats: external, harmful", "orange"],
    ]),
  },
  {
    id: "time",
    group: "Architecture and analysis",
    label: "TIME",
    keywords: ["time", "tolerate", "invest", "migrate", "eliminate", "application", "portfolio", "rationalisation", "rationalization", "2x2", "matrix", "quadrant"],
    // Business value up, technical fit to the right.
    frames: quadrants([
      ["Migrate: high value, poor fit", "blue"],
      ["Invest: high value, good fit", "green"],
      ["Eliminate: low value, poor fit", "pink"],
      ["Tolerate: low value, good fit", "yellow"],
    ]),
  },
  {
    id: "migration-strategy",
    group: "Architecture and analysis",
    label: "Migration strategy",
    keywords: ["migration", "strategy", "cloud", "rehost", "replatform", "refactor", "repurchase", "retire", "retain", "6 rs", "six rs"],
    frames: [
      ...row(0, 0, [
        ["Rehost: move as it is", "blue"],
        ["Replatform: move with small changes", "purple"],
        ["Refactor: rebuild for the new platform", "green"],
      ]),
      ...row(0, QUADRANT_H + GAP, [
        ["Repurchase: replace with a product", "orange"],
        ["Retire: switch off", "pink"],
        ["Retain: keep as it is for now", "yellow"],
      ]),
    ],
  },
  {
    id: "tech-radar",
    group: "Architecture and analysis",
    label: "Technology radar",
    keywords: ["technology", "tech", "radar", "adopt", "trial", "assess", "hold", "tools", "platforms", "columns"],
    frames: columns(0, 720, [
      ["Adopt", "green"],
      ["Trial", "blue"],
      ["Assess", "yellow"],
      ["Hold", "pink"],
    ]),
  },
  {
    id: "raid",
    group: "Architecture and analysis",
    label: "RAID",
    keywords: ["raid", "risks", "assumptions", "issues", "dependencies", "log", "project", "columns"],
    frames: columns(0, 720, [
      ["Risks", "pink"],
      ["Assumptions", "yellow"],
      ["Issues", "orange"],
      ["Dependencies", "blue"],
    ]),
  },
  {
    id: "architecture-decision",
    group: "Architecture and analysis",
    label: "Architecture decision",
    keywords: ["architecture", "decision", "record", "adr", "context", "options", "consequences", "design", "columns"],
    frames: columns(0, 720, [
      ["Context", "neutral"],
      ["Options", "blue"],
      ["Decision", "green"],
      ["Consequences", "orange"],
    ]),
  },
  /* ── Strategy and product ── */
  {
    id: "empathy-map",
    group: "Strategy and product",
    label: "Empathy map",
    keywords: ["empathy", "map", "user", "customer", "says", "thinks", "does", "feels", "research", "design", "2x2"],
    frames: [
      banner("Who is the user?", "yellow", TWO_BY_TWO_W),
      ...quadrants(
        [
          ["Says", "blue"],
          ["Thinks", "purple"],
          ["Does", "green"],
          ["Feels", "pink"],
        ],
        UNDER_BANNER,
      ),
    ],
  },
  {
    id: "persona",
    group: "Strategy and product",
    label: "Persona",
    keywords: ["persona", "user", "customer", "profile", "goals", "frustrations", "needs", "research", "design"],
    frames: [
      banner("Name and role", "yellow", TWO_BY_TWO_W),
      ...quadrants(
        [
          ["About them", "blue"],
          ["Goals", "green"],
          ["Frustrations", "pink"],
          ["What they need from us", "purple"],
        ],
        UNDER_BANNER,
      ),
    ],
  },
  {
    id: "pestle",
    group: "Strategy and product",
    label: "PESTLE",
    keywords: ["pestle", "pest", "political", "economic", "social", "technological", "legal", "environmental", "external", "analysis", "strategy"],
    frames: [
      ...row(0, 0, [
        ["Political", "pink"],
        ["Economic", "green"],
        ["Social", "yellow"],
      ]),
      ...row(0, QUADRANT_H + GAP, [
        ["Technological", "blue"],
        ["Legal", "purple"],
        ["Environmental", "orange"],
      ]),
    ],
  },
  {
    id: "five-whys",
    group: "Strategy and product",
    label: "Five whys",
    keywords: ["five whys", "5 whys", "why", "root cause", "problem", "analysis", "incident"],
    frames: [
      banner("Problem", "yellow", FIVE_W),
      ...(
        [
          ["Why? 1", "neutral"],
          ["Why? 2", "blue"],
          ["Why? 3", "purple"],
          ["Why? 4", "orange"],
          ["Why? 5", "pink"],
        ] as const
      ).map(([title, color], i): TemplateFrame => ({ title, color, x: i * (WHY_W + GAP), y: UNDER_BANNER, w: WHY_W, h: QUADRANT_H, style: HEADING })),
      banner("Root cause and fix", "green", FIVE_W, UNDER_BANNER + QUADRANT_H + GAP),
    ],
  },
  {
    id: "stakeholder-map",
    group: "Strategy and product",
    label: "Stakeholder map",
    keywords: ["stakeholder", "stakeholders", "power", "interest", "influence", "manage", "inform", "map", "2x2", "matrix", "quadrant"],
    // Power up, interest to the right.
    frames: quadrants([
      ["Keep satisfied: high power, low interest", "yellow"],
      ["Manage closely: high power, high interest", "pink"],
      ["Monitor: low power, low interest", "neutral"],
      ["Keep informed: low power, high interest", "blue"],
    ]),
  },
  {
    id: "risk-heatmap",
    group: "Strategy and product",
    label: "Risk heatmap",
    keywords: ["risk", "risks", "heatmap", "heat map", "likelihood", "impact", "probability", "severity", "2x2", "matrix", "quadrant"],
    // Likelihood up, impact to the right.
    frames: quadrants([
      ["Watch: likely, low impact", "yellow"],
      ["Act now: likely, high impact", "pink"],
      ["Accept: unlikely, low impact", "green"],
      ["Plan for: unlikely, high impact", "orange"],
    ]),
  },
];
