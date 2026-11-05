// Illustrative card previews: hand-written SVG, not screenshots of the live
// apps. Colours come from the shared tokens through the .pv-* classes in
// styles.css, so they follow the theme. No real data or figures.

const previews: Record<string, () => React.JSX.Element> = {
  // A small architecture diagram: three boxes, a database and connectors.
  Chalkline: () => (
    <>
      <path className="pv-line" d="M92 52h44M184 52h44M160 70v34" />
      <path className="pv-accent-stroke" d="M136 52l-7-4v8zM228 52l-7-4v8zM160 104l-4-7h8z" />
      <rect className="pv-box" x="36" y="34" width="56" height="36" rx="6" />
      <rect className="pv-box pv-box--accent" x="136" y="34" width="48" height="36" rx="6" />
      <rect className="pv-box" x="228" y="34" width="56" height="36" rx="6" />
      <path className="pv-box" d="M136 112c0-6 48-6 48 0v26c0 6-48 6-48 0z" />
      <path className="pv-line" d="M136 112c0 6 48 6 48 0" />
      <rect className="pv-text" x="46" y="49" width="36" height="6" rx="3" />
      <rect className="pv-text pv-text--on-accent" x="146" y="49" width="28" height="6" rx="3" />
      <rect className="pv-text" x="238" y="49" width="36" height="6" rx="3" />
    </>
  ),
  // A workshop board: two frames of sticky notes and a pointer.
  Stickyard: () => (
    <>
      <rect className="pv-frame" x="24" y="20" width="132" height="120" rx="8" />
      <rect className="pv-frame" x="164" y="20" width="132" height="120" rx="8" />
      {[
        [36, 40, "pv-note"],
        [96, 40, "pv-note pv-note--accent"],
        [36, 88, "pv-note pv-note--accent"],
        [176, 40, "pv-note"],
        [236, 40, "pv-note"],
        [176, 88, "pv-note pv-note--accent"],
      ].map(([x, y, c]) => (
        <rect key={`${x}-${y}`} className={c as string} x={x} y={y} width="48" height="40" rx="4" />
      ))}
      <path className="pv-pointer" d="M250 96l0 26 7-7 6 12 5-2-6-12h10z" />
    </>
  ),
  // A calculator: a line chart, an axis and a split bar. No figures.
  Sumyard: () => (
    <>
      <path className="pv-line" d="M32 24v92h256" />
      <path className="pv-line pv-line--dash" d="M32 92h256" />
      <path className="pv-accent-stroke pv-accent-stroke--wide" d="M32 108c40-4 64-20 96-34s64-26 96-34 40-14 64-16" />
      <circle className="pv-accent-fill" cx="224" cy="40" r="5" />
      <rect className="pv-box" x="32" y="128" width="256" height="14" rx="7" />
      <rect className="pv-accent-fill" x="32" y="128" width="168" height="14" rx="7" />
    </>
  ),
  // A small breakout game: bricks, a ball and a paddle.
  Arcade: () => (
    <>
      {[0, 1, 2].flatMap((row) =>
        [0, 1, 2, 3, 4, 5].map((col) => (
          <rect
            key={`${row}-${col}`}
            className={(row + col) % 2 ? "pv-box" : "pv-box pv-box--accent"}
            x={36 + col * 42}
            y={22 + row * 18}
            width="36"
            height="12"
            rx="3"
          />
        )),
      )}
      <path className="pv-line pv-line--dash" d="M150 128L186 96" />
      <circle className="pv-accent-fill" cx="190" cy="92" r="6" />
      <rect className="pv-text" x="124" y="132" width="64" height="8" rx="4" />
    </>
  ),
};

export function Preview({ name }: { name: string }) {
  const Drawing = previews[name];
  if (!Drawing) return null;
  return (
    <svg className="card__preview" viewBox="0 0 320 160" aria-hidden="true" focusable="false">
      <Drawing />
    </svg>
  );
}
