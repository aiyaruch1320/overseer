// The battle screens and their stories (imported by src/ui/screens.ts so the storybook lists them).
// The watch screen opens `BattleView` from a `combat/battle` log line (`battleModelAt(data, state, line.entry.n)`) and `WarPanel` from a
// `combat/war` `combat/campaign` or `combat/rank` line (`currentWar(data, state)`).
import './stories';
export { BattleView, posesAt, type BattleViewProps } from './BattleView';
export { WarPanel, type WarPanelProps } from './WarPanel';
export { battleAt, battleEntries, battleModel, battleModelAt, currentWar, isBattle, warFromCampaign, warInput, warModel, type BattleModel, type WarModel } from '../../app/views/battle';
