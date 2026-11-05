import "@krishnabuilds/tokens/tokens.css";
import "./styles.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { HowPage } from "./HowPage";
import { StoryPage } from "./StoryPage";
import { stories } from "./stories";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing #root element");
}

// Paths without a page fall back to the landing page (the Worker serves
// index.html for every path).
function Page() {
  if (/^\/how-this-is-built\/?$/.test(location.pathname)) {
    document.title = "How this is built · krishnabuilds";
    return <HowPage />;
  }
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
