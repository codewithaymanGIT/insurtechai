import { useEffect, useRef } from "react";
import { gsap, reducedMotion } from "../../lib/motion";

/**
 * Renders a number that tweens to each new value. On first mount it counts
 * up from `from` (default: 0); later changes tween from the previous value,
 * which is what makes the what-if simulator feel alive.
 */
export function CountUp({
  value,
  format = (n) => Math.round(n).toLocaleString("en-IN"),
  from = 0,
  duration = 1.1,
  delay = 0,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  from?: number;
  duration?: number;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const current = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reducedMotion()) {
      el.textContent = format(value);
      current.current = value;
      return;
    }
    const state = { v: current.current ?? from };
    const tween = gsap.to(state, {
      v: value,
      duration: current.current === null ? duration : 0.5,
      delay: current.current === null ? delay : 0,
      ease: "power3.out",
      onUpdate: () => {
        el.textContent = format(state.v);
        current.current = state.v;
      },
      onComplete: () => {
        current.current = value;
      },
    });
    return () => {
      tween.kill();
    };
    // format is expected to be stable in behaviour; excluding it avoids restarting the tween every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <span ref={ref} className={className}>
      {format(current.current ?? (reducedMotion() ? value : from))}
    </span>
  );
}
