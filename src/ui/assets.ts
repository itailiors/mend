/** Bundled brand/badge/icon assets (reused verbatim from assets/). */
import type { StampId } from '../types';
import abCompare from '../../assets/icons/ab-compare.svg?raw';
import fullMix from '../../assets/icons/full-mix.svg?raw';
import healedCheck from '../../assets/icons/healed-check.svg?raw';
import help from '../../assets/icons/help.svg?raw';
import pause from '../../assets/icons/pause.svg?raw';
import play from '../../assets/icons/play.svg?raw';
import share from '../../assets/icons/share.svg?raw';
import soloHeadphones from '../../assets/icons/solo-headphones.svg?raw';
import soundMuted from '../../assets/icons/sound-muted.svg?raw';
import soundOn from '../../assets/icons/sound-on.svg?raw';
import stats from '../../assets/icons/stats.svg?raw';
import themeToggle from '../../assets/icons/theme-toggle.svg?raw';
import chiefSurgeon from '../../assets/badges/stamp-chief-surgeon.png';
import goldenEars from '../../assets/badges/stamp-golden-ears.png';
import theoryAce from '../../assets/badges/stamp-theory-ace.png';
import trackRestored from '../../assets/badges/stamp-track-restored.png';

export const ICONS = {
  abCompare, fullMix, healedCheck, help, pause, play, share, soloHeadphones, soundMuted, soundOn, stats, themeToggle,
};

export const STAMPS: Record<StampId, { src: string; name: string }> = {
  'chief-surgeon': { src: chiefSurgeon, name: 'Chief Surgeon' },
  'track-restored': { src: trackRestored, name: 'Restored' },
  'theory-ace': { src: theoryAce, name: 'Theory Ace' },
  'golden-ears': { src: goldenEars, name: 'Golden Ears' },
};

export const STAMP_ORDER: StampId[] = ['chief-surgeon', 'track-restored', 'theory-ace', 'golden-ears'];
