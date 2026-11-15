// Pane widths shared by the inbox and its loading skeleton (full class names so Tailwind sees them).
// Below 900px only one pane shows at a time; below 1280px the side pane folds into the detail pane.

export const LIST_PANE_WIDTH = "min-[900px]:w-[clamp(320px,27vw,360px)] min-[900px]:shrink-0";
export const SIDE_PANE_WIDTH = "w-[clamp(280px,22vw,340px)]";
