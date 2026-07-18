import { SCROLL, SECTIONS } from "@/Experience/sceneConfig";

// A panel's focused route. The scene (in the root layout) reads the URL slug
// and drives the focus animation; this page's only job is to give the route
// real scrollable height so the user can scroll past the focused panel. The
// scene crossfades the panel's shards/title out as a single tall plane carrying
// every section fades in, and slides that plane up continuously as you scroll
// (see Focus.update and ScrollContent) — this markup is `sr-only`, kept for
// accessibility/SEO.
//
// The scroll budget: one sectionDistance per *gap* between sections, so the
// last section reaches the slot at the bottom of the page. The crossfade
// happens within the first section's slide, so it needs no budget of its own.
const SCROLL_VH = (SECTIONS.length - 1) * SCROLL.sectionDistance * 100;

export default function TitlePage() {
  return (
    <main className="relative panel-route-scroll" style={{ zIndex: 1 }}>
      <div style={{ height: "100vh" }} aria-hidden="true" />
      {/* All the route's scrollable height. It's a bare spacer because the
          text below is `sr-only` (position:absolute), so it adds no height of
          its own and can't carry this itself. */}
      <div style={{ height: `${SCROLL_VH}vh` }} aria-hidden="true" />
      <div className="sr-only">
        {SECTIONS.map((section) => (
          <section key={section.id} id={section.id}>
            <h2>{section.lines[0]}</h2>
            {section.lines.slice(1).map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </section>
        ))}
      </div>
    </main>
  );
}
