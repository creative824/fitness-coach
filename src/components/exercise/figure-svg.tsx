import {
  bounds,
  LEN,
  points,
  resolveRef,
  spineControl,
  type Demo,
  type Points,
  type Prop,
  type Pt,
  type Solved,
} from "@/lib/exercise/figure";

/** Which drawn segment lights up for a working muscle. */
const MUSCLE_SEGMENT: Record<string, ("torso" | "upperArm" | "forearm" | "thigh" | "shin" | "hip" | "shoulder")[]> = {
  chest: ["torso"],
  upper_back: ["torso"],
  lower_back: ["torso"],
  abs: ["torso"],
  obliques: ["torso"],
  shoulders: ["shoulder"],
  biceps: ["upperArm"],
  triceps: ["upperArm"],
  forearms: ["forearm"],
  glutes: ["hip"],
  quads: ["thigh"],
  hamstrings: ["thigh"],
  adductors: ["thigh"],
  calves: ["shin"],
};

const W = 7; // limb thickness
/** Props drawn behind the figure; the rest (weights, bands) are drawn in its hands. */
const BEHIND = new Set<Prop["k"]>(["mat", "box", "chair", "wall", "door", "line"]);

function line(a: Pt, b: Pt, cls: string, key: string, width = W) {
  return <line key={key} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} className={cls} strokeWidth={width} strokeLinecap="round" />;
}

function prop(pr: Prop, p: Points, i: number, top: number) {
  const k = `prop-${i}`;
  switch (pr.k) {
    case "mat":
      return <rect key={k} x={pr.x1} y={-2.5} width={pr.x2 - pr.x1} height={2.5} rx={1.2} className="fill-current opacity-15" />;
    case "box":
      return <rect key={k} x={pr.x} y={0} width={pr.w} height={pr.h} rx={2} className="fill-current opacity-15" />;
    case "chair": {
      const backX = pr.back === "left" ? pr.x + 1.5 : pr.x + pr.w - 1.5;
      return (
        <g key={k} className="stroke-current opacity-30" strokeWidth={3} strokeLinecap="round">
          <line x1={pr.x} y1={pr.seat} x2={pr.x + pr.w} y2={pr.seat} />
          <line x1={pr.x + 2} y1={pr.seat} x2={pr.x + 2} y2={0} />
          <line x1={pr.x + pr.w - 2} y1={pr.seat} x2={pr.x + pr.w - 2} y2={0} />
          {pr.back ? <line x1={backX} y1={pr.seat} x2={backX} y2={pr.seat + 22} /> : null}
        </g>
      );
    }
    case "wall":
      return <rect key={k} x={pr.x} y={0} width={4} height={top} className="fill-current opacity-15" />;
    case "door":
      return (
        <g key={k} className="fill-current opacity-15">
          <rect x={pr.x} y={0} width={4} height={top} />
        </g>
      );
    case "bar":
      return line([pr.x1, pr.y], [pr.x2, pr.y], "stroke-current opacity-40", k, 3);
    case "line":
      return line(resolveRef(pr.from, p), resolveRef(pr.to, p), "stroke-current opacity-30", k, 2.5);
    case "band":
      return line(resolveRef(pr.from, p), resolveRef(pr.to, p), "stroke-[var(--color-coral)] opacity-80", k, 1.6);
    case "dumbbell": {
      const [x, y] = p[pr.at];
      return pr.upright ? (
        <g key={k} className="fill-[var(--color-sky)]">
          <rect x={x - 1} y={y - 5} width={2} height={10} />
          <rect x={x - 3.5} y={y + 3} width={7} height={3} rx={1} />
          <rect x={x - 3.5} y={y - 6} width={7} height={3} rx={1} />
        </g>
      ) : (
        <g key={k} className="fill-[var(--color-sky)]">
          <rect x={x - 5} y={y - 1} width={10} height={2} />
          <rect x={x - 6} y={y - 3.5} width={3} height={7} rx={1} />
          <rect x={x + 3} y={y - 3.5} width={3} height={7} rx={1} />
        </g>
      );
    }
    case "kettlebell": {
      const [x, y] = p[pr.at];
      return <circle key={k} cx={x} cy={y - 5} r={4.5} className="fill-[var(--color-sky)]" />;
    }
    case "plate": {
      const [x, y] = p[pr.at];
      return <circle key={k} cx={x - 1} cy={y - 2} r={6} className="fill-[var(--color-sky)] opacity-90" />;
    }
    case "platform": {
      const [x, y] = p[pr.at];
      const r = (pr.angle * Math.PI) / 180;
      const dx = Math.cos(r + Math.PI / 2) * 11;
      const dy = Math.sin(r + Math.PI / 2) * 11;
      const ox = Math.cos(r) * 4.5;
      const oy = Math.sin(r) * 4.5;
      return line([x + ox - dx, y + oy - dy], [x + ox + dx, y + oy + dy], "stroke-current opacity-40", k, 3.5);
    }
  }
}

/**
 * One frame of a demonstration. Pure SVG, so it renders on the server and in the animated
 * client wrapper alike. Working muscles are tinted on the matching body segment.
 */
export function FigureSvg({
  demo,
  solved,
  highlight = [],
  className = "",
  title,
}: {
  demo: Demo;
  solved: Solved;
  highlight?: string[];
  className?: string;
  title?: string;
}) {
  const b = bounds(demo);
  const p = points(solved, demo.view);
  const hot = new Set(highlight.flatMap((m) => MUSCLE_SEGMENT[m] ?? []));
  const near = (part: keyof typeof MUSCLE_SEGMENT | string) => (hot.has(part as never) ? "stroke-[var(--color-coral)]" : "stroke-current");
  const far = demo.view === "front" ? "" : " opacity-45";
  const top = b.y + b.h;
  const props = demo.props ?? [];
  const isBehind = (x: Prop) => BEHIND.has(x.k);
  const behind = props.filter(isBehind);
  const inFront = props.filter((x) => !isBehind(x));
  const spine = spineControl(solved, p);

  return (
    <svg
      viewBox={`${b.x} ${-top} ${b.w} ${b.h}`}
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <g transform="scale(1,-1)" fill="none">
        {demo.floor === false ? null : line([b.x + 2, -1], [b.x + b.w - 2, -1], "stroke-current opacity-20", "floor", 1.2)}
        {behind.map((x, i) => prop(x, p, i, top))}
        {/* far side first, so the near side is drawn on top */}
        {line(p.fHip, p.fKnee, `${near("thigh")}${far}`, "f-thigh")}
        {line(p.fKnee, p.fAnkle, `${near("shin")}${far}`, "f-shin")}
        {line(p.fAnkle, p.fToe, `stroke-current${far}`, "f-foot", 5)}
        {line(p.fShoulder, p.fElbow, `${near("upperArm")}${far}`, "f-ua")}
        {line(p.fElbow, p.fWrist, `${near("forearm")}${far}`, "f-fa")}
        <path
          d={`M${p.hip[0]},${p.hip[1]} Q${spine[0]},${spine[1]} ${p.neck[0]},${p.neck[1]}`}
          className={near("torso")}
          strokeWidth={W + 3}
          strokeLinecap="round"
        />
        {demo.view === "front"
          ? [line(p.fShoulder, p.nShoulder, near("shoulder"), "shoulders", W), line(p.fHip, p.nHip, near("hip"), "hips", W)]
          : null}
        {hot.has("hip") ? <circle cx={p.hip[0]} cy={p.hip[1]} r={W / 2 + 1.5} className="fill-[var(--color-coral)]" /> : null}
        {hot.has("shoulder") && demo.view === "side" ? (
          <circle cx={p.nShoulder[0]} cy={p.nShoulder[1]} r={W / 2 + 1} className="fill-[var(--color-coral)]" />
        ) : null}
        <circle cx={p.head[0]} cy={p.head[1]} r={LEN.headR} className="fill-current" />
        {line(p.nHip, p.nKnee, near("thigh"), "n-thigh")}
        {line(p.nKnee, p.nAnkle, near("shin"), "n-shin")}
        {line(p.nAnkle, p.nToe, "stroke-current", "n-foot", 5)}
        {line(p.nShoulder, p.nElbow, near("upperArm"), "n-ua")}
        {line(p.nElbow, p.nWrist, near("forearm"), "n-fa")}
        {inFront.map((x, i) => prop(x, p, i + behind.length, top))}
      </g>
    </svg>
  );
}
