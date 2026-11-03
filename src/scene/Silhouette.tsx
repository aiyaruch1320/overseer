// The dark placeholder of a character in DOM and SVG (the calm picture between scenes draws it when the life has no look yet). The scene stage itself
// draws its own pixel silhouette (stage/controller.ts).
import type { ActorView } from './timeline';
import { FIGURE, POSE } from './tuning';

/** A head and a cloak, dark with a light rim. */
export function Silhouette({ a, frame }: { a: ActorView; frame: string }) {
  const pose = POSE[a.pose];
  const rim = a.tint ?? frame;
  const one = (k: number, n: number) => (
    <svg
      key={k}
      viewBox="0 0 60 120"
      style={{
        height: '100%',
        aspectRatio: '1 / 2',
        overflow: 'visible',
        transformOrigin: '50% 100%',
        transform: `translate(${(k - (n - 1) / 2) * 38}%, ${pose.drop * 100}%) rotate(${pose.rot}deg) scale(${pose.scale * (n > 1 ? FIGURE.crowdScale : 1)})`,
        transition: 'transform 0.4s',
      }}
    >
      <ellipse cx="30" cy="14" rx="9" ry="10" fill="#07080c" stroke={rim} stroke-opacity="0.55" stroke-width="1.2" />
      <path d="M13 114 L18 42 Q30 28 42 42 L47 114 Z" fill="#07080c" fill-opacity="0.92" stroke={rim} stroke-opacity="0.55" stroke-width="1.2" />
      {pose.arm ? <path d="M42 46 L54 14" stroke={rim} stroke-opacity="0.8" stroke-width="3" stroke-linecap="round" /> : null}
    </svg>
  );
  return <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', height: '100%' }}>{Array.from({ length: a.count }, (_, k) => one(k, a.count))}</div>;
}
