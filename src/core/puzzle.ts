/**
 * Controlled sabotage engine. Takes a clean groove and injects four verified bugs:
 *  1. Melody  — one out-of-key note a half/whole step off, rubbing a chord tone.
 *  2. Chords  — one bar's quality/root broken so a chord tone rubs a melody note.
 *  3. Bass    — one non-chord bass note rubbing the healed chord.
 *  4. Cadence — bar 4 misses the displayed target mood.
 * Stages 1–3 land on three different bars, so each bug is judged against clean layers.
 * A candidate day is rejected (and re-rolled from a forked seed) unless every stage has
 * exactly one accepted state in its control space.
 */
import type {
  BassFault, CadenceCategory, CadenceFault, CadenceMood, CadenceOption, Chord, ChordFault, ChordSabotageKind,
  Groove, MelodyFault, MendPuzzle, StageBugSpec, TrackValues,
} from '../types';
import { MOODS, baseRoman, composeGroove, romanChord } from './composer';
import { puzzleNumberFor, seedFor } from './daily';
import { type Rng, createRng } from './rng';
import { bassQuestion, cadenceQuestion, chordQuestion, melodyQuestion } from './theoryBonus';
import {
  bassMidi, chordLabel, chordPcs, chordRole, degreeLabel, flatName, isChordTone, isDiatonic, keyLabel, midiName, noteName,
  sameChord, semitoneRub,
} from './theory';
import { bassRule, chordControlSpace, chordRule, melodyPcsInBar, melodyRule, range } from './validator';

const MAX_ATTEMPTS = 64;

// ---------------------------------------------------------------------------
// Stage 1 — sour melody note
// ---------------------------------------------------------------------------

export function findMelodyFault(g: Groove, bar: number, rng: Rng): MelodyFault | null {
  const chord = g.chords[bar]!;
  const tones = chordPcs(chord);
  const slots = rng.shuffle([bar * 2, bar * 2 + 1]);
  for (const slot of slots) {
    const target = g.melody[slot]!.midi;
    for (const off of rng.shuffle([-1, 1, -2, 2])) {
      const sab = target + off;
      if (isDiatonic(sab, g.keyPc)) continue; // must be out of key
      const rub = semitoneRub(sab, tones);
      if (rub === null) continue; // must grind against the chord
      const min = sab - 2;
      const max = sab + 2;
      const accepted = range(min, max).filter((m) => melodyRule(g, bar, m));
      if (accepted.length !== 1 || accepted[0] !== target) continue; // unique repair
      return { bar, slot, sabotaged: sab, target, min, max, rubPc: rub };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Stage 2 — broken chord
// ---------------------------------------------------------------------------

export function findChordFault(g: Groove, bar: number, rng: Rng): ChordFault | null {
  const target = g.chords[bar]!;
  const accepted = chordControlSpace().filter((c) => chordRule(g, bar, c));
  if (accepted.length !== 1 || !sameChord(accepted[0]!, target)) return null;

  const melody = melodyPcsInBar(g, bar);
  const flip: Chord['quality'] = target.quality === 'min' ? 'maj' : 'min';
  const candidates: { chord: Chord; kind: ChordSabotageKind }[] = [
    { chord: { root: target.root, quality: flip }, kind: 'third' },
    ...rng.shuffle<{ chord: Chord; kind: ChordSabotageKind }>([
      { chord: { root: target.root, quality: 'dim' }, kind: 'dim' },
      { chord: { root: target.root, quality: '7' }, kind: 'seventh' },
      { chord: { root: target.root, quality: 'sus' }, kind: 'sus' },
      { chord: { root: (target.root + 1) % 12, quality: target.quality }, kind: 'root' },
      { chord: { root: (target.root + 11) % 12, quality: target.quality }, kind: 'root' },
    ]),
  ];
  // Quality flips (3 vs b3 cross-relations) are the signature bug; try them first most days.
  if (rng.chance(0.25)) candidates.push(candidates.shift()!);
  for (const { chord, kind } of candidates) {
    if (sameChord(chord, target) || chordRule(g, bar, chord)) continue;
    for (const tone of chordPcs(chord)) {
      const rub = semitoneRub(tone, melody);
      if (rub !== null) return { bar, sabotaged: chord, target, kind, rubMelodyPc: rub, rubChordPc: tone };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Stage 3 — bass betrayal
// ---------------------------------------------------------------------------

export function findBassFault(g: Groove, bar: number, rng: Rng): BassFault | null {
  const chord = g.chords[bar]!;
  const target = g.bass[bar]!;
  const min = target - 5;
  const max = target + 7;
  const accepted = range(min, max).filter((m) => bassRule(g, bar, m));
  if (accepted.length !== 1 || accepted[0] !== target) return null;
  const tones = chordPcs(chord);
  const third = tones[1]!;
  const fifth = tones[2]!;
  const above = (p: number) => target + ((p - target + 1200) % 12);
  for (const off of rng.shuffle([-1, 1, -2, 2])) {
    const sab = target + off;
    if (isChordTone(sab, chord)) continue;
    const rub = semitoneRub(sab, tones);
    if (rub === null) continue;
    return { bar, sabotaged: sab, target, min, max, chips: { root: target, third: above(third), fifth: above(fifth) }, rubPc: rub };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Stage 4 — cadence / mode polish
// ---------------------------------------------------------------------------

const CADENCE_POOL = ['I', 'vi', 'V7', 'IV', 'IVmaj7#11', 'iim6', 'iv', 'ii'] as const;

export function cadenceCategory(roman: string, bar3: string): CadenceCategory {
  const prev = baseRoman(bar3);
  switch (roman) {
    case 'I': return prev === 'V' ? 'authentic' : prev === 'IV' ? 'plagal' : 'tonic';
    case 'vi': return prev === 'V' ? 'deceptive' : 'submediant';
    case 'V':
    case 'V7': return 'half';
    case 'IVmaj7#11': return 'lydian';
    case 'iim6': return 'dorian';
    case 'iv': return 'borrowed';
    case 'IV': return 'subdominant';
    default: return 'other';
  }
}

export function moodOf(g: Groove): CadenceMood {
  const target = g.romans[3];
  const mood = (Object.keys(MOODS) as CadenceMood[]).find(
    (m) => MOODS[m].target === target && cadenceCategory(target, g.romans[2]) === m,
  );
  if (!mood) throw new Error(`No mood for ${g.romans.join(' ')}`);
  return mood;
}

export function buildCadenceFault(g: Groove, rng: Rng): CadenceFault {
  const mood = moodOf(g);
  const option = (roman: string): CadenceOption => {
    const chord = romanChord(roman, g.keyPc);
    return { chord, roman, label: chordLabel(chord, g.keyPc), category: cadenceCategory(roman, g.romans[2]) };
  };
  const correct = option(g.romans[3]);
  const distractors = rng
    .shuffle(CADENCE_POOL.filter((r) => r !== g.romans[3]).map(option))
    .filter((o) => o.category !== mood)
    .filter((o, i, all) => all.findIndex((x) => sameChord(x.chord, o.chord)) === i)
    .slice(0, 3);
  const candidates = rng.shuffle([correct, ...distractors]);
  const correctIndex = candidates.indexOf(correct);
  const wrong = candidates.map((_, i) => i).filter((i) => i !== correctIndex);
  return { mood, moodLabel: MOODS[mood].label, candidates, correctIndex, sabotagedIndex: rng.pick(wrong) };
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

function cadenceAnswer(g: Groove, mood: CadenceMood): { answer: string; explanation: string } {
  const n = (p: number) => noteName(p, g.keyPc);
  const tonic = n(g.keyPc);
  const ivRoot = (g.keyPc + 5) % 12;
  const iiRoot = (g.keyPc + 2) % 12;
  switch (mood) {
    case 'authentic': return { answer: 'Dominant V falls to tonic I', explanation: `The V chord's leading tone (${n(g.keyPc + 11)}) pulls up a half step to ${tonic}: the strongest "home" landing in music.` };
    case 'deceptive': return { answer: 'V steps to vi instead of I', explanation: `V sets up ${tonic}, then the bass steps up to ${n(g.keyPc + 9)} — vi shares two notes with I, so it lands softly but surprisingly.` };
    case 'plagal': return { answer: 'IV settles straight onto I', explanation: `IV → I keeps ${tonic} ringing on both chords and glides home without a leading tone: the hymn-ending "A-men".` };
    case 'half': return { answer: 'The phrase pauses on V', explanation: `Ending on V (${n(g.keyPc + 7)}) leaves the leading tone hanging, so the loop feels like a question that bar 1 answers.` };
    case 'lydian': return { answer: `Raised #4 (${n(ivRoot + 6)} over ${n(ivRoot)})`, explanation: `${n(ivRoot)}maj7#11 adds ${n(ivRoot + 6)}, a raised 4th above the root — the floating, wide-eyed Lydian colour.` };
    case 'dorian': return { answer: `Natural 6 (${n(iiRoot + 9)} in ${n(iiRoot)} minor)`, explanation: `${n(iiRoot)}m6 adds ${n(iiRoot + 9)}, a major 6th over a minor chord — the warm, hopeful Dorian signature.` };
    case 'borrowed': return { answer: `Borrowed from ${tonic} minor (b6 ${flatName(g.keyPc + 8)})`, explanation: `${n(ivRoot)} min borrows ${flatName(g.keyPc + 8)} from the parallel minor key — the bittersweet sigh at the end of so many ballads.` };
  }
}

function trySabotage(g: Groove, rng: Rng): Omit<MendPuzzle, 'puzzleNumber' | 'dateIso'> | null {
  const perms = rng.shuffle([[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]);
  for (const [b1, b2, b3] of perms) {
    const melodyFault = findMelodyFault(g, b1!, rng.fork(`m${b1}`));
    if (!melodyFault) continue;
    const chordFault = findChordFault(g, b2!, rng.fork(`c${b2}`));
    if (!chordFault) continue;
    const bassFault = findBassFault(g, b3!, rng.fork(`b${b3}`));
    if (!bassFault) continue;
    const cadenceFault = buildCadenceFault(g, rng.fork('cadence'));
    return assemble(g, melodyFault, chordFault, bassFault, cadenceFault, rng.fork('theory'));
  }
  return null;
}

function assemble(g: Groove, mf: MelodyFault, cf: ChordFault, bf: BassFault, kf: CadenceFault, rng: Rng): Omit<MendPuzzle, 'puzzleNumber' | 'dateIso'> {
  const k = g.keyPc;
  const restored: TrackValues = { melody: g.melody.map((n) => n.midi), chords: [...g.chords], bass: [...g.bass] };
  const sabCad = kf.candidates[kf.sabotagedIndex]!;
  const broken: TrackValues = {
    melody: restored.melody.map((m, i) => (i === mf.slot ? mf.sabotaged : m)),
    chords: restored.chords.map((c, i) => (i === cf.bar ? cf.sabotaged : i === 3 ? sabCad.chord : c)),
    bass: restored.bass.map((b, i) => (i === bf.bar ? bf.sabotaged : i === 3 ? bassMidi(sabCad.chord.root) : b)),
  };
  const lbl = (c: Chord) => chordLabel(c, k);
  const mChord = g.chords[mf.bar]!;
  const bChord = g.chords[bf.bar]!;
  const correctCad = kf.candidates[kf.correctIndex]!;

  const stages: MendPuzzle['stages'] = [
    {
      layerId: 'melody',
      stageNumber: 1,
      promptLine: `Nudge the sour note in Bar ${mf.bar + 1} until it locks onto the chord.`,
      faultySlotIndex: mf.slot,
      sabotagedValue: midiName(mf.sabotaged, k),
      targetValue: midiName(mf.target, k),
      theoryBonus: melodyQuestion(rng.fork('q1'), {
        sabName: midiName(mf.sabotaged, k),
        targetName: midiName(mf.target, k),
        bar: mf.bar,
        chordLabel: lbl(mChord),
        degree: degreeLabel(mf.sabotaged, k),
        rubName: `${chordRole(mf.rubPc, mChord) ?? 'tone'} ${noteName(mf.rubPc, k)}`,
        key: keyLabel(k),
      }),
    },
    {
      layerId: 'chords',
      stageNumber: 2,
      promptLine: `Bar ${cf.bar + 1}'s chord clashes with the melody — flip its root or quality until it fits.`,
      faultySlotIndex: cf.bar,
      sabotagedValue: lbl(cf.sabotaged),
      targetValue: lbl(cf.target),
      theoryBonus: chordQuestion(rng.fork('q2'), {
        kind: cf.kind,
        sabLabel: lbl(cf.sabotaged),
        targetLabel: lbl(cf.target),
        bar: cf.bar,
        rubChordName: noteName(cf.rubChordPc, k),
        rubMelodyName: noteName(cf.rubMelodyPc, k),
      }),
    },
    {
      layerId: 'bass',
      stageNumber: 3,
      promptLine: `Ground Bar ${bf.bar + 1}: lock the bass onto the healed chord's root.`,
      faultySlotIndex: bf.bar,
      sabotagedValue: midiName(bf.sabotaged, k),
      targetValue: midiName(bf.target, k),
      theoryBonus: bassQuestion(rng.fork('q3'), {
        sabName: midiName(bf.sabotaged, k),
        chordLabel: lbl(bChord),
        rootName: noteName(bChord.root, k),
        rubName: `the ${chordRole(bf.rubPc, bChord) ?? 'tone'} (${noteName(bf.rubPc, k)})`,
      }),
    },
    {
      layerId: 'cadence',
      stageNumber: 4,
      promptLine: 'Pick the Bar 4 chord that lands the target mood.',
      targetMoodPill: kf.moodLabel,
      faultySlotIndex: 3,
      sabotagedValue: sabCad.label,
      targetValue: correctCad.label,
      theoryBonus: cadenceQuestion(rng.fork('q4'), kf.mood, cadenceAnswer(g, kf.mood)),
    },
  ] as [StageBugSpec, StageBugSpec, StageBugSpec, StageBugSpec];

  return {
    bpm: g.bpm,
    keySignature: keyLabel(k),
    bars: restored.chords.map(lbl) as MendPuzzle['bars'],
    stages,
    groove: g,
    broken,
    restored,
    melodyFault: mf,
    chordFault: cf,
    bassFault: bf,
    cadenceFault: kf,
  };
}

const cache = new Map<string, MendPuzzle>();

/** The deterministic daily puzzle for a UTC date (YYYY-MM-DD). */
export function generatePuzzle(dateIso: string): MendPuzzle {
  const hit = cache.get(dateIso);
  if (hit) return hit;
  const root = createRng(seedFor(dateIso));
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const rng = root.fork(`attempt-${attempt}`);
    const groove = composeGroove(rng.fork('groove'));
    const body = trySabotage(groove, rng.fork('sabotage'));
    if (body) {
      const puzzle: MendPuzzle = { puzzleNumber: puzzleNumberFor(dateIso), dateIso, ...body };
      cache.set(dateIso, puzzle);
      return puzzle;
    }
  }
  throw new Error(`MEND: no solvable puzzle for ${dateIso}`);
}
