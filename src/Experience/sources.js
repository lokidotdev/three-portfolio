import { FONT_URL, PANELS, SECTIONS, sectionImageName } from "./sceneConfig.js";

const sources = [
  {
    name: "titleFont",
    type: "font",
    path: FONT_URL,
  },
  ...PANELS.map((panel) => ({
    name: panel.name,
    type: "texture",
    path: panel.src,
  })),
  ...SECTIONS.flatMap((section) =>
    section.images.map((image, i) => ({
      name: sectionImageName(section, i),
      type: "texture",
      path: image.src,
    }))
  ),
];

export default sources;
