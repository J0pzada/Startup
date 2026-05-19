import { gsap } from "gsap";
import { useEffect, useRef } from "react";

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function PageShell({ children, routeKey }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || prefersReducedMotion()) return undefined;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ref.current,
        { y: 12 },
        {
          y: 0,
          duration: 0.34,
          ease: "power2.out",
          clearProps: "transform",
        }
      );
    }, ref);

    return () => ctx.revert();
  }, [routeKey]);

  return (
    <main className="page-shell" ref={ref}>
      {children}
    </main>
  );
}
