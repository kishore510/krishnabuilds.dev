// The list of apps on krishnabuilds.dev. The single source for both the site
// header menu and the Portal's landing page cards.

export type AppGroup = "create" | "calculate" | "play" | "tinker";

export type AppStatus = "live" | "beta" | "building" | "idea";

export type AppEntry = {
  name: string;
  blurb: string;
  url: string;
  group: AppGroup;
  status: AppStatus;
  stack: string[];
};

// Display order and headings for the landing page groups.
export const groups: { id: AppGroup; label: string }[] = [
  { id: "create", label: "Create" },
  { id: "calculate", label: "Calculate" },
  { id: "play", label: "Play" },
  { id: "tinker", label: "Tinker" },
];

export const statusLabels: Record<AppStatus, string> = {
  live: "Live",
  beta: "Beta",
  building: "Building",
  idea: "Idea",
};

// Live and beta apps can be opened; building and idea are not reachable yet.
export function isOpen(app: AppEntry): boolean {
  return app.status === "live" || app.status === "beta";
}

export const apps: AppEntry[] = [
  {
    name: "Arcade",
    blurb: "Quick browser games to play in a spare minute.",
    url: "https://arcade.krishnabuilds.dev",
    group: "play",
    status: "live",
    stack: ["React", "TypeScript"],
  },
  {
    name: "Chalkline",
    blurb: "Architecture and whiteboard diagramming in the browser.",
    url: "https://chalkline.krishnabuilds.dev",
    group: "create",
    status: "live",
    stack: ["React", "TypeScript", "Cloudflare"],
  },
  {
    name: "Stickyard",
    blurb: "Collaborative sticky notes for working things out together.",
    url: "https://stickyard.krishnabuilds.dev",
    group: "create",
    status: "live",
    stack: ["React", "TypeScript", "Cloudflare", "Durable Objects"],
  },
  {
    name: "Sumyard",
    blurb: "Personal finance calculators for UK tax, pensions and mortgages.",
    url: "https://sumyard.krishnabuilds.dev",
    group: "calculate",
    status: "live",
    stack: ["React", "TypeScript", "Cloudflare"],
  },
];
