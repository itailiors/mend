/** Bandle-adjacent diagnostic share card (ux-spec View 7), built from the real solve. */
import type { LayerId, MendPuzzle, MendSummary, SharePayload } from '../types';
import { LAYERS } from '../types';
import { STAMP_TITLE } from './state';

export const MEND_URL = 'https://itailiors.github.io/mend/';

const ICON: Record<LayerId, string> = { melody: '🎵', chords: '🎹', bass: '🎸', cadence: '✨' };
const NAME: Record<LayerId, string> = { melody: 'Melody', chords: 'Chords', bass: 'Bass', cadence: 'Cadence' };

export function buildShare(p: MendPuzzle, summary: MendSummary): SharePayload {
  // The headline speaks to precision (spec: "Track Restored!" even with 4/4 ⭐); stars show per line.
  const title = summary.stampId === 'theory-ace' ? STAMP_TITLE['track-restored'] : STAMP_TITLE[summary.stampId];
  const headline = `🩺 MEND #${p.puzzleNumber} — ${title}`;
  const lines = LAYERS.map((id, i) => {
    const l = summary.layers.find((x) => x.layerId === id)!;
    const tries = Math.max(1, l.tries);
    const dot = tries === 1 ? '🟢' : '🟡';
    const triesTxt = `(${tries} ${tries === 1 ? 'try' : 'tries'})`;
    const star = l.theoryAce ? `⭐ ${p.stages[i]!.theoryBonus.shareTag}` : '';
    return `${ICON[id]} ${NAME[id].padEnd(9)}${dot} ${triesTxt.padEnd(8)} ${star}`.trimEnd();
  });
  const footer = `Checks: ${summary.totalTaps} (par 4) | Theory Aces: ${summary.theoryAces}/4 ⭐`;
  return { puzzleNumber: p.puzzleNumber, headline, shareText: [headline, ...lines, footer, MEND_URL].join('\n') };
}
