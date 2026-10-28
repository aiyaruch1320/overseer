import Phaser from 'phaser';
import './ui/style.css';
import { WorldScene } from './scenes/WorldScene';
import { CityScene } from './scenes/CityScene';
import { UI } from './ui/ui';

const world = new WorldScene();
const city = new CityScene();
const ui = new UI(world, city);
world.onReady = () => ui.start();
const host = document.getElementById('map')!;
const game = new Phaser.Game({
  type: Phaser.CANVAS,
  parent: 'map',
  backgroundColor: '#13243a',
  pixelArt: true,
  scale: { mode: Phaser.Scale.RESIZE, width: Math.max(320, host.clientWidth), height: Math.max(240, host.clientHeight) },
  scene: [world, city],
});

// keep the canvas matched to its container (window resizes, layout changes)
new ResizeObserver(() => game.scale.resize(Math.max(320, host.clientWidth), Math.max(240, host.clientHeight))).observe(host);

if (import.meta.env.DEV) (window as unknown as { __ui: UI }).__ui = ui;
