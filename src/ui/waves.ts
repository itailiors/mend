/** Mini 4-bar oscilloscope strips: jagged coral on a faulted bar, breathing sine when healed, flat when locked. */
import type { LayerId } from '../types';

export type WaveState = 'locked' | 'broken' | 'healed';

export function miniWaveSvg(layer: LayerId, state: WaveState, faultBar: number): string {
  let paths = '';
  for (let b = 0; b < 4; b++) {
    const x0 = b * 50 + 2;
    if (state === 'broken' && b === faultBar) {
      paths += `<path class="wave-glitch-anim" d="M${x0} 13 L${x0 + 7} 4 L${x0 + 14} 22 L${x0 + 21} 3 L${x0 + 28} 23 L${x0 + 35} 5 L${x0 + 42} 20 L${x0 + 46} 13" fill="none" stroke="var(--state-glitch)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
    } else if (state === 'locked') {
      paths += `<path d="M${x0} 13 L${x0 + 46} 13" fill="none" stroke="var(--state-locked)" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.55"/>`;
    } else {
      const amp = layer === 'bass' ? 8 : 6;
      paths += `<path class="wave-healed-anim" d="M${x0} 13 Q${x0 + 11} ${13 - amp} ${x0 + 23} 13 T${x0 + 46} 13" fill="none" stroke="var(--lane-${layer})" stroke-width="2" stroke-linecap="round"/>`;
    }
  }
  return `<svg class="mini-wave-svg" viewBox="0 0 200 26" preserveAspectRatio="none" aria-hidden="true">${paths}</svg>`;
}
