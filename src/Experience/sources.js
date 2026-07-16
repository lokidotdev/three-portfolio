import { FONT_URL, PANELS } from "./sceneConfig.js";

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
];

export default sources;
