// Illustrative card art: hand-written SVG, not screenshots of the live apps.
// Each scene is drawn in its app's own colour (the card's --hue, set in
// styles.css) through the .pv-* classes, so it follows the theme. No real
// data or figures. Motion is CSS only and is off under prefers-reduced-motion.

type Hue = "teal" | "purple" | "green" | "amber" | "saffron";

function Note({ x, y, hue, turn }: { x: number; y: number; hue: Hue; turn: number }) {
  return (
    <g transform={`rotate(${turn} ${x + 22} ${y + 20})`}>
      <rect className={`pv-tint pv-tint--${hue}`} x={x} y={y} width="44" height="40" rx="3" />
      <path className={`pv-rule pv-rule--${hue}`} d={`M${x + 8} ${y + 13}h28M${x + 8} ${y + 22}h20`} />
    </g>
  );
}

function Cursor({ x, y, hue, className }: { x: number; y: number; hue: Hue; className?: string }) {
  return (
    <g className={className}>
      <path
        className={`pv-cursor pv-fill--${hue}`}
        d={`M${x} ${y}v20l5.5-5.5 4.5 9 4-2-4.5-9h8z`}
      />
      <rect className={`pv-fill--${hue}`} x={x + 12} y={y + 20} width="30" height="11" rx="5.5" />
    </g>
  );
}

// Bricks already knocked out of the Arcade wall, as "row-col".
const gone = new Set(["2-3", "3-2", "3-3", "3-4", "3-5", "2-4"]);
const brickHues: Hue[] = ["saffron", "amber", "teal", "purple"];

const previews: Record<string, () => React.JSX.Element> = {
  // A diagram being edited: boxes, a database, a queue, one node selected.
  Chalkline: () => (
    <>
      <path className="pv-line" d="M92 60h30M192 60h30M260 80v30" />
      <path className="pv-hue-stroke pv-march" d="M160 86v24M60 80v26" />
      <path className="pv-hue-fill" d="M128 60l-8-4.5v9zM228 60l-8-4.5v9zM160 116l-4.5-8h9z" />
      <rect className="pv-panel" x="28" y="40" width="64" height="40" rx="6" />
      <rect className="pv-hue-fill" x="128" y="40" width="64" height="40" rx="6" />
      <rect className="pv-panel" x="228" y="40" width="64" height="40" rx="6" />
      <rect className="pv-select" x="121" y="33" width="78" height="54" rx="2" />
      {[
        [118, 30],
        [196, 30],
        [118, 84],
        [196, 84],
      ].map(([x, y]) => (
        <rect key={`${x}-${y}`} className="pv-handle" x={x} y={y} width="6" height="6" />
      ))}
      <path className="pv-panel" d="M134 122c0-7 52-7 52 0v24c0 7-52 7-52 0z" />
      <path className="pv-line" d="M134 122c0 7 52 7 52 0" />
      <rect className="pv-panel" x="232" y="110" width="56" height="34" rx="17" />
      <path className="pv-line" d="M250 120v14M260 120v14M270 120v14" />
      <rect className="pv-tint" x="32" y="106" width="56" height="42" rx="4" />
      <path className="pv-rule" d="M42 120h36M42 130h26" />
      <rect className="pv-text" x="42" y="57" width="36" height="6" rx="3" />
      <rect className="pv-text pv-text--on-hue" x="142" y="57" width="36" height="6" rx="3" />
      <rect className="pv-text" x="242" y="57" width="36" height="6" rx="3" />
      <path className="pv-cursor pv-cursor--ink" d="M206 92v20l5.5-5.5 4.5 9 4-2-4.5-9h8z" />
    </>
  ),
  // A shared board: two frames of sticky notes and two people's cursors.
  Stickyard: () => (
    <>
      <rect className="pv-frame" x="14" y="26" width="142" height="136" rx="8" />
      <rect className="pv-frame" x="164" y="26" width="142" height="136" rx="8" />
      <rect className="pv-text" x="14" y="12" width="46" height="6" rx="3" />
      <rect className="pv-text" x="164" y="12" width="34" height="6" rx="3" />
      <Note x={28} y={42} hue="amber" turn={-3} />
      <Note x={90} y={40} hue="purple" turn={2} />
      <Note x={30} y={102} hue="teal" turn={2} />
      <Note x={92} y={100} hue="saffron" turn={-2} />
      <Note x={178} y={42} hue="green" turn={2} />
      <Note x={240} y={44} hue="amber" turn={-2} />
      <Note x={180} y={102} hue="purple" turn={-3} />
      <rect className="pv-frame" x="242" y="104" width="44" height="40" rx="3" />
      <Cursor x={126} y={76} hue="purple" className="pv-drift" />
      <Cursor x={250} y={116} hue="teal" className="pv-drift pv-drift--late" />
    </>
  ),
  // A calculator: a projection against a baseline, a split and two bars.
  Sumyard: () => (
    <>
      <path className="pv-grid" d="M24 48h180M24 72h180M24 96h180" />
      <path className="pv-line" d="M24 22v98h180" />
      <path className="pv-area" d="M24 108c36-4 56-22 84-32s52-32 96-42v86H24z" />
      <path className="pv-line pv-line--dash" d="M24 112c46-2 96-14 180-36" />
      <path className="pv-hue-stroke pv-hue-stroke--wide" d="M24 108c36-4 56-22 84-32s52-32 96-42" />
      <circle className="pv-halo pv-pulse" cx="204" cy="34" r="10" />
      <circle className="pv-hue-fill" cx="204" cy="34" r="5" />
      <circle className="pv-ring" cx="260" cy="70" r="28" />
      <circle className="pv-ring pv-ring--hue" cx="260" cy="70" r="28" transform="rotate(-90 260 70)" />
      <rect className="pv-text" x="246" y="67" width="28" height="6" rx="3" />
      <rect className="pv-text" x="24" y="139" width="36" height="6" rx="3" />
      <rect className="pv-panel" x="72" y="137" width="224" height="10" rx="5" />
      <rect className="pv-hue-fill" x="72" y="137" width="150" height="10" rx="5" />
      <rect className="pv-text" x="24" y="159" width="28" height="6" rx="3" />
      <rect className="pv-panel" x="72" y="157" width="224" height="10" rx="5" />
      <rect className="pv-tint" x="72" y="157" width="92" height="10" rx="5" />
    </>
  ),
  // A brick game mid-rally: a broken wall, a ball, a paddle and three lives.
  Arcade: () => (
    <>
      {[
        [40, 104],
        [84, 128],
        [118, 96],
        [228, 100],
        [270, 124],
        [296, 96],
        [22, 140],
        [246, 150],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} className="pv-star" cx={x} cy={y} r="1.5" />
      ))}
      {brickHues.flatMap((hue, row) =>
        [0, 1, 2, 3, 4, 5, 6].map((col) =>
          gone.has(`${row}-${col}`) ? null : (
            <rect
              key={`${row}-${col}`}
              className={`pv-fill--${hue}`}
              x={24 + col * 39}
              y={20 + row * 16}
              width="34"
              height="11"
              rx="3"
            />
          ),
        ),
      )}
      <circle className="pv-ball" cx="176" cy="104" r="6" />
      <rect className="pv-paddle" x="112" y="152" width="72" height="9" rx="4.5" />
      {[24, 38, 52].map((x) => (
        <circle key={x} className="pv-hue-fill" cx={x + 4} cy="160" r="4" />
      ))}
      <rect className="pv-text" x="252" y="157" width="44" height="6" rx="3" />
    </>
  ),
  // An illustrated map: a peninsula, hills, a river, a route and a chapter card.
  "Story Maps": () => (
    <>
      <path className="pv-grid" d="M0 150c40-10 70 8 110 0M210 30c30-8 60 6 110-4M228 172c30-8 50 4 92-2" />
      <path
        className="pv-land"
        d="M36 0h214c10 26-6 48-16 72s-26 46-40 70c-8 14-14 22-22 30-10-8-18-22-28-40-14-24-40-40-54-66C78 46 50 28 36 0z"
      />
      <path className="pv-land" d="M200 156c8-6 20-4 24 4s-4 16-14 14-16-10-10-18z" />
      <path className="pv-line" d="M92 30l8-11 8 11M114 34l8-11 8 11M138 28l8-11 8 11" />
      <path className="pv-grid" d="M150 34c10 14 30 10 42 22s22 8 36 14" />
      <path
        className="pv-hue-stroke pv-hue-stroke--wide pv-march"
        d="M110 56c22 6 34 18 38 36s4 28 14 40 28 18 46 30"
      />
      {[
        [110, 56],
        [148, 92],
        [162, 132],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} className="pv-pin" cx={x} cy={y} r="5.5" />
      ))}
      <circle className="pv-halo pv-pulse" cx="210" cy="163" r="11" />
      <circle className="pv-hue-fill" cx="210" cy="163" r="5.5" />
      <circle className="pv-line" cx="282" cy="62" r="17" />
      <path className="pv-fill--amber" d="M282 42l4 16 16 4-16 4-4 16-4-16-16-4 16-4z" />
      <rect className="pv-panel" x="240" y="98" width="66" height="58" rx="6" />
      <rect className="pv-hue-fill" x="250" y="109" width="22" height="5" rx="2.5" />
      <rect className="pv-text" x="250" y="121" width="46" height="5" rx="2.5" />
      <rect className="pv-text" x="250" y="131" width="38" height="5" rx="2.5" />
      {[250, 259, 268, 277].map((x, i) => (
        <circle key={x} className={i < 3 ? "pv-hue-fill" : "pv-dot"} cx={x + 2} cy="146" r="2" />
      ))}
    </>
  ),
};

export function Preview({ name }: { name: string }) {
  const Drawing = previews[name];
  if (!Drawing) return null;
  return (
    <svg className="card__preview" viewBox="0 0 320 180" aria-hidden="true" focusable="false">
      <Drawing />
    </svg>
  );
}
