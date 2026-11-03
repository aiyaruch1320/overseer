// Numbers of the bridge that the docs do not set (code-plan §2 rule 3: one tuning file per part).
import { FAST_SPEED_MUL, SEC_PER_YEAR } from '../core/attention';

/** Real seconds of one beat (a quarter of a life year) at the speed `normal`: a whole life of 75 years in 35 minutes (07-attention.md §1). */
export const SEC_PER_BEAT = SEC_PER_YEAR / 4;

/** How much faster the speed `fast` runs (assumption: 07-attention.md names the setting, not its factor). */
export const SPEED_MUL: Record<'normal' | 'fast', number> = { normal: 1, fast: FAST_SPEED_MUL };

/** The most beats the clock runs in one animation frame when the tab comes back after a while (it does not run years in one frame). */
export const MAX_BEATS_PER_FRAME = 4;

/** Lines of the story log the watch screen keeps (older lines stay in the save, not in the view). */
export const LOG_KEEP = 400;

/** The key of the save in the browser's storage. */
export const SAVE_KEY = 'overseer.save.1';
