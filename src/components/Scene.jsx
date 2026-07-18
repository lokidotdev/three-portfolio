"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

import Experience from "@/Experience/Experience";

// Mounts the canvas and owns the Experience's lifetime. Everything else lives
// in src/Experience.
const Scene = () => {
  const canvasRef = useRef(null);
  const experienceRef = useRef(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    experienceRef.current = new Experience(canvasRef.current);
    return () => {
      experienceRef.current.destroy();
      experienceRef.current = null;
    };
  }, []);

  // The scene is imperative and set up once, so it can't read fresh hooks —
  // the router and the current URL are pushed in instead. Each route starts
  // its own scroll (fresh sections on a new panel), so the page and the
  // scene's scroll state both reset on navigation.
  useEffect(() => {
    const experience = experienceRef.current;
    if (!experience) return;
    experience.router = router;
    experience.setPath(pathname);
    window.scrollTo(0, 0);
    // Not snapped: leaving a panel route mid-scroll, the scene eases its scroll
    // back to the top, which is what plays the shards and title back in before
    // the panel reassembles (see Focus.update).
    experience.setScroll(0, window.innerHeight);
  }, [router, pathname]);

  // Panel routes render real (if visually hidden) scrollable content below
  // the canvas — see [slug]/page.js. Scrolling it drives the scene's fade of
  // the focused panel's shards/title and the content plane's section.
  useEffect(() => {
    const onScroll = () => {
      experienceRef.current?.setScroll(window.scrollY, window.innerHeight);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return <canvas ref={canvasRef} className="scene-canvas" />;
};

export default Scene;
