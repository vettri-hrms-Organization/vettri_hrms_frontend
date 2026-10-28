import { useEffect, useRef, useState } from 'react';

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Counts up to `value` once it arrives (ease-out, ~0.9s). Renders the final
 * value immediately under reduced motion or when requestAnimationFrame is
 * unavailable (tests, SSR). Screen readers always get the real number.
 */
export default function AnimatedNumber({ value, duration = 900, format = (n) => n.toLocaleString('en-IN') }) {
  const target = Number(value) || 0;
  const [display, setDisplay] = useState(() => (prefersReducedMotion() ? target : 0));
  const frame = useRef(0);

  useEffect(() => {
    if (prefersReducedMotion() || typeof requestAnimationFrame !== 'function') {
      setDisplay(target);
      return undefined;
    }
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setDisplay(Math.round(target * eased));
      if (t < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame.current);
  }, [target, duration]);

  return (
    <>
      <span aria-hidden="true">{format(display)}</span>
      <span className="visually-hidden">{format(target)}</span>
    </>
  );
}
