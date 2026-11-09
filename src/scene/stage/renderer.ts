// Which renderer new stages use. A page that shows many stages at once (the storybook's grid of rites) asks for the 2D canvas, because a browser
// gives a page only some sixteen WebGL contexts and the rest come up blank. The game itself never sets this: its one live stage uses WebGL.
export const stageRenderer = { canvas: false };
