import "@krishnabuilds/tokens/tokens.css";
import "./styles.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { StoryPage } from "./StoryPage";
import { stories } from "./stories";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing #root element");
}

// Paths without a page fall back to the landing page (the Worker serves
// index.html for every path).
function Page() {
  const slug = location.pathname.match(/^\/stories\/([a-z-]+)\/?$/)?.[1];
  const story = stories.find((entry) => entry.slug === slug);
  if (story) {
    document.title = `The story of ${story.app} · krishnabuilds`;
    return <StoryPage story={story} />;
  }
  return <App />;
}

createRoot(root).render(
  <StrictMode>
    <Page />
  </StrictMode>,
);
