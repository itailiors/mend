/** Optional "🎓 Theory Diagnosis" questions — one per sabotaged layer, built from the real bug. */
import type { CadenceMood, ChordSabotageKind, TheoryBonusQuestion } from '../types';
import type { Rng } from './rng';

function build(rng: Rng, prompt: string, correct: string, pool: readonly string[], explanation: string, shareTag: string): TheoryBonusQuestion {
  const distractors = rng.shuffle(pool.filter((p) => p !== correct)).slice(0, 2);
  const options = rng.shuffle([correct, ...distractors]) as [string, string, string];
  return { prompt, options, correctIndex: options.indexOf(correct) as 0 | 1 | 2, explanation, shareTag };
}

const MELODY_DISTRACTORS = ['Missing octave jump', 'Wrong time signature', 'Rhythm landed off the beat', 'Note held too long', 'Swing feel was too heavy'];

export function melodyQuestion(rng: Rng, a: { sabName: string; targetName: string; bar: number; chordLabel: string; degree: string; rubName: string; key: string }): TheoryBonusQuestion {
  return build(
    rng,
    `Why did ${a.sabName} sour Bar ${a.bar + 1} over ${a.chordLabel}?`,
    `Out-of-key ${a.degree} rubbing ${a.rubName}`,
    MELODY_DISTRACTORS,
    `${a.sabName} is the ${a.degree} of ${a.key} — outside the scale and a half step from the chord's ${a.rubName}, so the two pitches grind. ${a.targetName} is a chord tone and locks in.`,
    `Out-of-Key ${a.degree}`,
  );
}

const CHORD_ANSWERS: Record<ChordSabotageKind, { answer: string; tag: string }> = {
  third: { answer: 'Major vs. minor 3rd', tag: 'Wrong 3rd (Maj/min)' },
  root: { answer: 'Chord built on the wrong root', tag: 'Wrong Root' },
  dim: { answer: 'Diminished b5 clash', tag: 'Flat 5th' },
  seventh: { answer: 'Out-of-key b7 added', tag: 'Wrong 7th' },
  sus: { answer: 'Sus4 fighting the 3rd', tag: 'Sus4 vs 3rd' },
};

/** Names the actual bug first, so the explanation backs the correct option rather than a distractor. */
function chordWhy(a: { kind: ChordSabotageKind; sabLabel: string; targetLabel: string; rubChordName: string; rubMelodyName: string }): string {
  const rub = `${a.rubChordName} grinds a half step against the melody's ${a.rubMelodyName}`;
  switch (a.kind) {
    case 'third': return `${a.sabLabel} has the wrong 3rd: its ${rub}. ${a.targetLabel} flips the 3rd so the melody note is a chord tone.`;
    case 'root': return `${a.sabLabel} sits on the wrong root, a half step off, so its ${rub}. Moving the root gives ${a.targetLabel}, which holds the melody note.`;
    case 'dim': return `${a.sabLabel} flattens the 5th: its ${rub}. ${a.targetLabel} restores the perfect 5th.`;
    case 'seventh': return `${a.sabLabel} adds a b7 the melody doesn't want: its ${rub}. ${a.targetLabel} drops it.`;
    case 'sus': return `${a.sabLabel} swaps the 3rd for a 4th: its ${rub}. ${a.targetLabel} puts the 3rd back.`;
  }
}

export function chordQuestion(rng: Rng, a: { kind: ChordSabotageKind; sabLabel: string; targetLabel: string; bar: number; rubChordName: string; rubMelodyName: string }): TheoryBonusQuestion {
  const pool = [...Object.values(CHORD_ANSWERS).map((x) => x.answer), 'Parallel fifths', 'Missing bass octave'];
  return build(rng, `What made ${a.sabLabel} clash in Bar ${a.bar + 1}?`, CHORD_ANSWERS[a.kind].answer, pool, chordWhy(a), CHORD_ANSWERS[a.kind].tag);
}

export function bassQuestion(rng: Rng, a: { sabName: string; chordLabel: string; rootName: string; rubName: string }): TheoryBonusQuestion {
  return build(
    rng,
    `Why did ${a.sabName} clash under ${a.chordLabel}?`,
    'Non-chord bass, half step off',
    ['Perfect 5th doubling', 'Plagal cadence', 'Parallel octaves', 'Bass too far below the kick'],
    `${a.sabName} isn't in ${a.chordLabel} and rubs a half step against ${a.rubName}. Grounding the bar on the root (${a.rootName}) makes the whole chord ring.`,
    'Missed Root',
  );
}

const CADENCE_ANSWERS: Record<CadenceMood, { prompt: string; tag: string }> = {
  authentic: { prompt: 'What makes the Authentic cadence resolve?', tag: 'V→I' },
  deceptive: { prompt: 'Which move creates the Deceptive surprise?', tag: 'Deceptive V→vi' },
  plagal: { prompt: 'What gives the Plagal "Amen" its sound?', tag: 'Plagal IV→I' },
  half: { prompt: 'Why does the Half Cadence feel unfinished?', tag: 'Half Cadence' },
  lydian: { prompt: 'Which tone creates the Dreamy Lydian lift?', tag: 'Lydian #4' },
  dorian: { prompt: 'Which tone gives the Dorian warmth?', tag: 'Dorian ♮6' },
  borrowed: { prompt: 'Where does the bittersweet iv come from?', tag: 'Borrowed iv' },
};

export function cadenceQuestion(rng: Rng, mood: CadenceMood, a: { answer: string; explanation: string }): TheoryBonusQuestion {
  const generic = [
    'Dominant V falls to tonic I',
    'V steps to vi instead of I',
    'IV settles straight onto I',
    'The phrase pauses on V',
    'Flattened b2 (Phrygian)',
    'Diminished 7th tension',
    'Tritone substitution',
  ];
  return build(rng, CADENCE_ANSWERS[mood].prompt, a.answer, generic, a.explanation, CADENCE_ANSWERS[mood].tag);
}
