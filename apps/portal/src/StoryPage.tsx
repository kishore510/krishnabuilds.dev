import { apps, isOpen, SiteHeader } from "@krishnabuilds/ui";

import { Footer } from "./Footer";
import { type Block, type Story, sectionTitles } from "./stories";

function Paragraph({ block }: { block: Block }) {
  if (typeof block === "string") return <p>{block}</p>;
  return (
    <p className="todo">
      <strong>To do:</strong> {block.todo}
    </p>
  );
}

// The story page template: the same six sections for every app.
export function StoryPage({ story }: { story: Story }) {
  const app = apps.find((entry) => entry.name === story.app);
  return (
    <>
      <SiteHeader apps={apps} />
      <main className="page story">
        <p className="story__back">
          <a href="/">← All apps</a>
        </p>
        <header className="story__head">
          {story.draft && <p className="story__draft">Draft</p>}
          <h1>The story of {story.app}</h1>
          <Paragraph block={story.intro} />
          {app && isOpen(app) && (
            <a className="button button--primary" href={app.url}>
              Open {story.app}
            </a>
          )}
        </header>
        {(Object.keys(sectionTitles) as (keyof Story["sections"])[]).map(
          (key) => (
            <section key={key} className="story__section">
              <h2>{sectionTitles[key]}</h2>
              {story.sections[key].map((block, i) => (
                <Paragraph key={i} block={block} />
              ))}
            </section>
          ),
        )}
      </main>
      <Footer />
    </>
  );
}
