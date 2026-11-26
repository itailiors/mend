/**
 * MEND data & event contracts (design/claude-code-handoff.md §4) plus the internal
 * puzzle model the composer, sabotage engine, validator and audio engine share.
 */

// ---------------------------------------------------------------------------
// Public contracts (verbatim from the handoff)
// ---------------------------------------------------------------------------

export type LayerId = 'melody' | 'chords' | 'bass' | 'cadence';

export type LayerStatus = 'locked' | 'active' | 'healed' | 'patched';

export interface TheoryBonusQuestion {
  prompt: string;
  options: [string, string, string];
  correctIndex: 0 | 1 | 2;
  explanation: string;
  shareTag: string;
}

export interface StageBugSpec {
  layerId: LayerId;
  stageNumber: 1 | 2 | 3 | 4;
  promptLine: string;
  targetMoodPill?: string;
  faultySlotIndex: number;
  sabotagedValue: string;
  targetValue: string;
  theoryBonus: TheoryBonusQuestion;
}

export interface LayerTrackState {
  layerId: LayerId;
  status: LayerStatus;
  tries: number;
  theoryAce: boolean;
  selectedSlotIndex: number;
  currentValue: string;
}

export interface DailyMendPuzzle {
  puzzleNumber: number;
  dateIso: string;
  bpm: number;
  keySignature: string;
  bars: [string, string, string, string];
  stages: [StageBugSpec, StageBugSpec, StageBugSpec, StageBugSpec];
}

export type StampId = 'chief-surgeon' | 'track-restored' | 'theory-ace' | 'golden-ears';

export interface MendSummary {
  puzzleNumber: number;
  totalTaps: number;
  theoryAces: number;
  stampId: StampId;
  layers: LayerTrackState[];
}

export interface SharePayload {
  puzzleNumber: number;
  headline: string;
  shareText: string;
}

export interface MendVisualHooks {
  onBeat(beatIdx: number): void;
  onBarStart(barIdx: number): void;
  onAuditionChange(layerId: LayerId, slotIdx: number): void;
  onWrongAttempt(layerId: LayerId, slotIdx: number): void;
  onLayerMended(layerId: LayerId, tries: number): void;
  onTheoryBonus(layerId: LayerId, correct: boolean): void;
  onAllRestored(summary: MendSummary): void;
}

// ---------------------------------------------------------------------------
// Internal musical model
// ---------------------------------------------------------------------------

export const LAYERS: readonly LayerId[] = ['melody', 'chords', 'bass', 'cadence'];

/** Chord qualities the Stage 2 flipper can reach (the control space). */
export type EditableQuality = 'maj' | 'min' | '7' | 'dim' | 'sus';
/** Extra colours that only appear as Stage 4 cadence candidates. */
export type Quality = EditableQuality | 'maj7#11' | 'm6';

export interface Chord {
  /** Root pitch class 0..11 (C = 0). */
  root: number;
  quality: Quality;
}

/** One melody note; times are in 16th-note steps across the 64-step loop. */
export interface MelodyNote {
  midi: number;
  start: number;
  dur: number;
}

export interface PatternHit {
  step: number;
  dur: number;
  /** Semitones above the bar's bass note (bass patterns only). */
  offset?: number;
  vel?: number;
}

export interface DrumPattern {
  kick: number[];
  snare: number[];
  hat: number[];
  /** Hat steps played louder (accents). */
  hatAccent: number[];
}

/** The clean, fully musical groove the sabotage engine starts from. */
export interface Groove {
  keyPc: number;
  bpm: number;
  /** Roman numerals of bars 1–4 (bar 4 = the correct cadence chord). */
  romans: [string, string, string, string];
  chords: [Chord, Chord, Chord, Chord];
  /** Bass note per bar (MIDI, octave 2 region). */
  bass: [number, number, number, number];
  melody: MelodyNote[];
  comp: PatternHit[];
  bassPattern: PatternHit[];
  drums: DrumPattern;
}

/** Every value the player can change, for one full rendition of the track. */
export interface TrackValues {
  melody: number[];
  chords: Chord[];
  bass: number[];
}

export type CadenceMood = 'authentic' | 'deceptive' | 'plagal' | 'half' | 'lydian' | 'dorian' | 'borrowed';
export type CadenceCategory = CadenceMood | 'tonic' | 'subdominant' | 'submediant' | 'other';

export interface CadenceOption {
  chord: Chord;
  roman: string;
  label: string;
  category: CadenceCategory;
}

export interface MelodyFault {
  bar: number;
  slot: number;
  sabotaged: number;
  target: number;
  /** Inclusive nudge range (MIDI) for the faulty slot. */
  min: number;
  max: number;
  /** Chord tone the sour note rubs against (pitch class). */
  rubPc: number;
}

export type ChordSabotageKind = 'third' | 'root' | 'dim' | 'seventh' | 'sus';

export interface ChordFault {
  bar: number;
  sabotaged: Chord;
  target: Chord;
  kind: ChordSabotageKind;
  /** Melody pitch class the broken chord rubs against. */
  rubMelodyPc: number;
  /** Broken chord tone that causes the rub. */
  rubChordPc: number;
}

export interface BassFault {
  bar: number;
  sabotaged: number;
  target: number;
  min: number;
  max: number;
  /** MIDI notes for the Root / 3rd / 5th role chips. */
  chips: { root: number; third: number; fifth: number };
  rubPc: number;
}

export interface CadenceFault {
  mood: CadenceMood;
  moodLabel: string;
  candidates: CadenceOption[];
  correctIndex: number;
  sabotagedIndex: number;
}

/** Full daily puzzle: the public contract plus the data the engines need. */
export interface MendPuzzle extends DailyMendPuzzle {
  groove: Groove;
  broken: TrackValues;
  restored: TrackValues;
  melodyFault: MelodyFault;
  chordFault: ChordFault;
  bassFault: BassFault;
  cadenceFault: CadenceFault;
}
