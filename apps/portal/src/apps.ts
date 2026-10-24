// The list of apps on krishnabuilds.dev. Drives both the site header menu and
// the landing page cards.
//
// Keep this file free of imports so it can move into packages/ui as-is.

export type AppStatus = "live" | "soon";

export type AppEntry = {
  name: string;
  blurb: string;
  url: string;
  status: AppStatus;
};

export const apps: AppEntry[] = [
  {
    name: "Arcade",
    blurb: "Quick browser games to play in a spare minute.",
    url: "https://arcade.krishnabuilds.dev",
    status: "live",
  },
  {
    name: "Chalkline",
    blurb: "Diagramming and whiteboard for sketching ideas.",
    url: "https://chalkline.krishnabuilds.dev",
    status: "soon",
  },
  {
    name: "Stickyard",
    blurb: "Sticky notes for jotting things down and moving them around.",
    url: "https://stickyard.krishnabuilds.dev",
    status: "soon",
  },
  {
    name: "Sumyard",
    blurb: "Quick sums and simple calculations.",
    url: "https://sumyard.krishnabuilds.dev",
    status: "soon",
  },
];
