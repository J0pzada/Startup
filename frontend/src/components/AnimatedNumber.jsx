import { gsap } from "gsap";
import { useEffect, useRef } from "react";

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function AnimatedNumber({ value = 0, formatter = (v) => String(v), duration = 1 }) {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    if (prefersReducedMotion()) {
      node.textContent = formatter(value);
      return undefined;
    }

    const previousValue = Number(node.dataset.current);
    const targetValue = Number(value) || 0;
    const state = { current: Number.isFinite(previousValue) ? previousValue : targetValue };
    const tween = gsap.to(state, {
      current: targetValue,
      duration,
      ease: "power2.out",
      onUpdate: () => {
        node.textContent = formatter(state.current);
      },
      onComplete: () => {
        node.textContent = formatter(targetValue);
        node.dataset.current = String(targetValue);
      },
    });

    return () => {
      tween.kill();
    };
  }, [value, formatter, duration]);

  return <span ref={ref}>{formatter(value)}</span>;
}
