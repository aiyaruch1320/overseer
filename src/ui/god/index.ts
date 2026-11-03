// The god's screens (docs/appearance/20-god-ui.md §3 to §9). The watch screen mounts `<GodPanel />` once and calls `openGod(kind, args)`.
export { GodPanel, openGod, closeGod, godOpen, type GodOpen } from './panel';
export { askGod } from './confirm';
export { registerGodMap, type GodMapProps } from './map-slot';
export { storeBridge, sampleBridge, type GodBridge } from './bridge';
export { GOD_KINDS, type GodKind } from '../../app/views/god';
export { GodEffectLine } from './effect-line';
