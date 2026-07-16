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
  // the router and the current URL are pushed in instead.
  useEffect(() => {
    const experience = experienceRef.current;
    if (!experience) return;
    experience.router = router;
    experience.setPath(pathname);
  }, [router, pathname]);

  return <canvas ref={canvasRef} className="scene-canvas" />;
};

export default Scene;
