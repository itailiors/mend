/**
 * MEND UI controller: renders the preview's DOM/CSS from real game state, wires the
 * Tone.js engine to the 7 MendVisualHooks, and persists everything to localStorage.
 */
import type { EditableQuality, LayerId, MendPuzzle, MendSummary, MendVisualHooks } from '../types';
import { LAYERS } from '../types';
import { MendAudioEngine, type MixMode } from '../audio/engine';
import { EDITABLE_QUALITIES, QUALITY_KEYCAP, chordLabel, keyShort, midiName, noteName, voiceChord } from '../core/theory';
import {
  type GameState, STAMP_TITLE, activeLayer, answerTheory, checkFix, isVictory, newGame, nudgeBass, nudgeMelody,
  pickCadence, setBass, setChordQuality, skipTheory, stepChordRoot, summarize,
} from '../game/state';
import { buildShare } from '../game/share';
import { type NoteLabels, type SaveData, type Theme, displayStreak, loadSave, recordWin, writeSave } from '../game/storage';
import { ICONS, STAMPS, STAMP_ORDER } from './assets';
import { type WaveState, miniWaveSvg } from './waves';

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return el as T;
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export class MendApp {
  private readonly p: MendPuzzle;
  private s: GameState;
  private save: SaveData;
  private readonly engine: MendAudioEngine;
  private readonly hooks: MendVisualHooks;
  private mixMode: MixMode = 'mix';
  private abMode: 'after' | 'before' = 'after';
  private muted = false;
  private gateOpen = true;
  private theoryRevealed = false;
  private healingLayer: LayerId | null = null;
  private lastFrameMs = 0;
  private toastTimer = 0;
  private trackWidth = 0;

  constructor(puzzle: MendPuzzle) {
    this.p = puzzle;
    this.save = loadSave();
    const saved = this.save.days[puzzle.dateIso]?.state;
    this.s = saved && saved.dateIso === puzzle.dateIso && saved.values?.melody?.length === 8 ? saved : newGame(puzzle);
    this.hooks = this.makeHooks();
    this.engine = new MendAudioEngine({
      onBeat: (b) => this.hooks.onBeat(b),
      onBarStart: (b) => this.hooks.onBarStart(b),
      onFrame: (progress) => this.onFrame(progress),
      onNeedsResume: (needs) => ($('resumeAudioPill').hidden = !needs),
    });
    this.engine.load(puzzle.groove, this.playbackValues());
  }

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------

  mount(): void {
    this.applySettings();
    this.renderStatic();
    this.bindEvents();
    if (this.save.settings.noteLabels === 'show' && !isVictory(this.s)) this.s.labelsSeen = true;
    this.ensureWinRecorded();
    this.render();
    // A reload between a heal and its theory card would otherwise leave Check Fix disabled forever.
    if (this.s.pendingTheory) this.openTheorySheet(this.s.pendingTheory);
    this.measure();
    window.addEventListener('resize', () => this.measure());
  }

  /** Record today's win as soon as the state reaches victory (idempotent per day). */
  private ensureWinRecorded(): MendSummary | null {
    if (!isVictory(this.s)) return null;
    const summary = summarize(this.p, this.s);
    if (this.save.stats.lastWinIso !== this.p.dateIso) {
      this.save.stats = recordWin(this.save.stats, this.p.dateIso, summary);
    }
    this.persist(summary);
    return summary;
  }

  private renderStatic(): void {
    const p = this.p;
    const k = p.groove.keyPc;
    $('puzzlePill').textContent = `#${p.puzzleNumber}`;
    $('telemetryText').innerHTML = `${p.bpm}<span class="telemetry-bpm-unit"> BPM</span> · ${keyShort(k)}`;
    $('unlockPill').textContent = `#${p.puzzleNumber} · ${p.bpm} BPM`;
    $('unlockKey').textContent = `KEY: ${keyShort(k)}`;
    const restored = isVictory(this.s);
    $('unlockFaults').textContent = restored ? '● TRACK RESTORED · REPLAY READY' : `● ${this.faultsLeft()} SIGNAL FAULT${this.faultsLeft() === 1 ? '' : 'S'} DETECTED`;
    $('unlockAudioBtn').textContent = restored ? '▶ Replay Restored Track' : '▶ Listen to Broken Track';
    document.title = `MEND #${p.puzzleNumber} — Daily Musical Surgery`;

    $('barRuler').innerHTML = [0, 1, 2, 3]
      .map((b) => `<div class="ruler-bar" data-bar="${b}"><span>BAR ${b + 1}</span><span class="ruler-ticks">${'<i class="ruler-tick"></i>'.repeat(4)}</span></div>`)
      .join('');

    $('prompt-melody').textContent = p.stages[0].promptLine;
    $('prompt-chords').textContent = p.stages[1].promptLine;
    $('prompt-bass').textContent = p.stages[2].promptLine;
    $('targetMoodPill').textContent = `🎯 Target: ${p.cadenceFault.moodLabel}`;

    $('helpBtn').innerHTML = ICONS.help;
    $('statsBtn').innerHTML = ICONS.stats;
    $('settingsBtn').innerHTML = ICONS.themeToggle;
    $('soloIcon').innerHTML = ICONS.soloHeadphones;
    $('mixIcon').innerHTML = ICONS.fullMix;
  }

  private faultsLeft(): number {
    return LAYERS.filter((id) => this.s.layers[id].status === 'active' || this.s.layers[id].status === 'locked').length;
  }

  private measure(): void {
    this.trackWidth = $('playheadBeam').parentElement?.clientWidth ?? 0;
  }

  // ---------------------------------------------------------------------------
  // Settings & persistence
  // ---------------------------------------------------------------------------

  private applySettings(): void {
    const { theme, noteLabels } = this.save.settings;
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-note-labels', noteLabels);
    $('themeDarkBtn').classList.toggle('is-active', theme === 'dark');
    $('themeLightBtn').classList.toggle('is-active', theme === 'light');
    $('labelsShowBtn').classList.toggle('is-active', noteLabels === 'show');
    $('labelsEarBtn').classList.toggle('is-active', noteLabels === 'ear-only');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0B0E14' : '#F2F1EC');
  }

  private setTheme(t: Theme): void {
    this.save.settings.theme = t;
    this.applySettings();
    this.persist();
  }

  private setNoteLabels(m: NoteLabels): void {
    this.save.settings.noteLabels = m;
    // Golden Ears needs labels hidden for the whole run, not just at each check.
    if (m === 'show' && !isVictory(this.s)) this.s.labelsSeen = true;
    this.applySettings();
    this.persist();
  }

  private persist(summary?: MendSummary): void {
    const day = this.save.days[this.p.dateIso];
    this.save.days[this.p.dateIso] = { state: this.s, summary: summary ?? day?.summary ?? null };
    writeSave(this.save);
  }

  // ---------------------------------------------------------------------------
  // Values the engine should hear right now
  // ---------------------------------------------------------------------------

  private playbackValues() {
    return isVictory(this.s) && this.abMode === 'before' ? this.p.broken : this.s.values;
  }

  private syncAudio(): void {
    this.engine.setValues(this.playbackValues());
  }

  // ---------------------------------------------------------------------------
  // Visual hooks (handoff §4 / motion-spec §4)
  // ---------------------------------------------------------------------------

  private makeHooks(): MendVisualHooks {
    return {
      onBeat: (beatIdx) => {
        const bar = Math.floor(beatIdx / 4);
        const beat = beatIdx % 4;
        document.querySelectorAll<HTMLElement>('.ruler-bar').forEach((el, b) => {
          el.classList.toggle('is-current-bar', b === bar);
          el.querySelectorAll('.ruler-tick').forEach((t, ti) => t.classList.toggle('is-on', b === bar && ti === beat));
        });
        const led = $('beatLed');
        led.classList.add('is-beat');
        window.setTimeout(() => led.classList.remove('is-beat'), 90);
        document.querySelectorAll<HTMLElement>('[data-bar-of]').forEach((el) => {
          el.classList.toggle('is-under-playhead', Number(el.dataset.barOf) === bar);
        });
      },
      onBarStart: (barIdx) => {
        const layer = activeLayer(this.s);
        if (!layer || this.faultBar(layer) !== barIdx) return;
        const lane = $(`lane-${layer}`);
        lane.classList.add('is-bar-pulse');
        window.setTimeout(() => lane.classList.remove('is-bar-pulse'), 160);
      },
      onAuditionChange: (layerId, slotIdx) => {
        const sel = this.slotSelector(layerId, slotIdx);
        const el = sel ? document.querySelector<HTMLElement>(sel) : null;
        if (!el) return;
        el.classList.add('is-press');
        window.setTimeout(() => el.classList.remove('is-press'), 90);
      },
      onWrongAttempt: (layerId, slotIdx) => {
        const lane = $(`lane-${layerId}`);
        this.restartClass(lane, 'is-shaking', 400);
        const sel = this.slotSelector(layerId, slotIdx);
        const slot = sel ? document.querySelector<HTMLElement>(sel) : null;
        if (slot) this.restartClass(slot, 'is-shaking', 400);
        const hint: Record<LayerId, string> = {
          melody: `Still sour — keep nudging the Bar ${this.p.melodyFault.bar + 1} note`,
          chords: `Still clashing — listen closely to Bar ${this.p.chordFault.bar + 1}`,
          bass: `Not grounded — find Bar ${this.p.bassFault.bar + 1}'s root`,
          cadence: 'Not the target mood yet — audition the other cards',
        };
        this.toast(hint[layerId], 'warn');
      },
      onLayerMended: (layerId, tries) => {
        this.healingLayer = layerId;
        const lane = $(`lane-${layerId}`);
        this.restartClass(lane, 'is-healing', 560);
        // The coral slot swaps to healed at 50% of the sweep.
        window.setTimeout(() => {
          this.healingLayer = null;
          this.render();
        }, reducedMotion() ? 0 : 260);
        this.toast(tries === 1 ? `🟢 Clean Fix — ${layerId.toUpperCase()} healed!` : `🟡 Patched in ${tries} tries — ${layerId.toUpperCase()} healed!`, 'ok');
        window.setTimeout(() => this.openTheorySheet(layerId), reducedMotion() ? 0 : 420);
      },
      onTheoryBonus: (layerId, correct) => {
        if (correct) {
          this.toast('⭐ Theory Ace Earned!', 'ok');
          this.render();
          document.querySelector(`#badges-${layerId} .star-badge`)?.classList.add('is-pop');
        } else {
          this.toast('Good ear anyway — here’s why', 'warn');
        }
      },
      onAllRestored: () => {
        const summary = this.ensureWinRecorded() ?? summarize(this.p, this.s);
        this.abMode = 'after';
        this.mixMode = 'mix';
        this.engine.setFocus('mix', null);
        this.syncAudio();
        this.render();
        this.toast(`${STAMP_TITLE[summary.stampId]} Track restored`, 'ok');
      },
    };
  }

  private faultBar(layer: LayerId): number {
    switch (layer) {
      case 'melody': return this.p.melodyFault.bar;
      case 'chords': return this.p.chordFault.bar;
      case 'bass': return this.p.bassFault.bar;
      case 'cadence': return 3;
    }
  }

  private slotSelector(layer: LayerId, slot: number): string | null {
    switch (layer) {
      case 'melody': return `[data-melody-slot="${slot}"]`;
      case 'chords': return `[data-chord-slot="${slot}"]`;
      case 'bass': return `[data-bass-slot="${slot}"]`;
      case 'cadence': return `[data-cadence-slot="${slot}"]`;
    }
  }

  private restartClass(el: HTMLElement, cls: string, ms: number): void {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    window.setTimeout(() => el.classList.remove(cls), ms);
  }

  private onFrame(progress: number): void {
    const now = performance.now();
    if (reducedMotion() && now - this.lastFrameMs < 66) return; // 15 fps when motion is reduced
    this.lastFrameMs = now;
    if (!this.trackWidth) this.measure();
    $('playheadBeam').style.transform = `translate3d(${(progress * this.trackWidth).toFixed(2)}px, 0, 0)`;
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  private render(): void {
    const victory = isVictory(this.s);
    const before = victory && this.abMode === 'before';
    $('lanesStack').classList.toggle('is-victory', victory);
    $('victoryBanner').classList.toggle('is-visible', victory);
    $('abToggleBar').classList.toggle('is-visible', victory);

    LAYERS.forEach((id, idx) => {
      const lane = $(`lane-${id}`);
      const L = this.s.layers[id];
      const expanded = !victory && this.s.stage === idx;
      lane.classList.toggle('is-expanded', expanded);
      lane.classList.toggle('is-collapsed', !expanded && !victory);
      lane.classList.toggle('is-solo-dimmed', !victory && this.mixMode === 'solo' && idx !== this.s.stage);

      const healing = this.healingLayer === id;
      const status = before || (L.status === 'active' || healing) ? 'broken' : L.status === 'locked' ? 'locked' : L.status;
      lane.dataset.status = status;
      const wave: WaveState = status === 'broken' ? 'broken' : status === 'locked' ? 'locked' : 'healed';
      $(`wave-${id}`).innerHTML = miniWaveSvg(id, wave, this.faultBar(id));

      let badges = '';
      if (before) badges = `<span class="status-pill status-pill--broken"><span class="note-label-text">${esc(this.p.stages[idx]!.sabotagedValue)}</span><span class="note-ear-dot"></span></span>`;
      else if (status === 'locked') badges = '<span class="status-pill status-pill--locked">🔒 Pending</span>';
      else if (status === 'broken') badges = `<span class="status-pill status-pill--broken">Fault · Bar ${this.faultBar(id) + 1}</span>`;
      else if (status === 'healed') badges = '<span class="status-pill status-pill--healed">🟢 1 try</span>';
      else badges = `<span class="status-pill status-pill--patched">🟡 ${L.tries} tries</span>`;
      if (L.theoryAce && !before) badges += '<span class="star-badge" aria-label="Theory ace">⭐</span>';
      $(`badges-${id}`).innerHTML = badges;
    });

    this.renderMelody();
    this.renderChords();
    this.renderBass();
    this.renderCadence();
    this.renderVictory();
    this.renderDock();
  }

  private renderMelody(): void {
    const p = this.p;
    const f = p.melodyFault;
    const k = p.groove.keyPc;
    const vals = this.s.values.melody;
    const L = this.s.layers.melody;
    const broken = L.status === 'active' || this.healingLayer === 'melody';
    const all = [...vals, f.min, f.max];
    const lo = Math.min(...all);
    const span = Math.max(1, Math.max(...all) - lo);
    $('melodyGrid').innerHTML = vals
      .map((midi, i) => {
        const isFault = i === f.slot;
        const cls = [
          'melody-note-btn',
          isFault && broken ? 'is-broken' : '',
          isFault && broken ? 'is-selected' : '',
          isFault && !broken ? 'is-healed-slot' : '',
          !isFault ? 'is-locked-note' : '',
        ].join(' ');
        const t = (midi - lo) / span;
        return `<div class="melody-col"><button type="button" class="${cls}" style="bottom:calc((100% - 52px) * ${t.toFixed(3)})" data-melody-slot="${i}" data-bar-of="${Math.floor(p.groove.melody[i]!.start / 16)}" aria-label="Bar ${Math.floor(i / 2) + 1} note ${i + 1}${isFault ? ' (fault)' : ''}">
          <span class="note-label-text">${midiName(midi, k)}</span><span class="note-ear-dot"></span></button></div>`;
      })
      .join('');
    $('melodyReadoutTag').textContent = `BAR ${f.bar + 1} · NOTE ${f.slot + 1}`;
    $('melodyCurrentNote').textContent = midiName(vals[f.slot]!, k);
    const active = this.s.stage === 0 && !this.s.pendingTheory;
    $<HTMLButtonElement>('melodyDownBtn').disabled = !active || vals[f.slot]! <= f.min;
    $<HTMLButtonElement>('melodyUpBtn').disabled = !active || vals[f.slot]! >= f.max;
  }

  private renderChords(): void {
    const p = this.p;
    const f = p.chordFault;
    const k = p.groove.keyPc;
    const L = this.s.layers.chords;
    const broken = L.status === 'active' || this.healingLayer === 'chords';
    $('chordsGrid').innerHTML = this.s.values.chords
      .map((c, i) => {
        const isFault = i === f.bar;
        const cls = ['bar-slot-card', isFault && broken ? 'is-broken is-selected' : '', !isFault ? 'is-locked-bar' : ''].join(' ');
        return `<button type="button" class="${cls}" data-chord-slot="${i}" data-bar-of="${i}">
          <span class="bar-slot-tag">BAR ${i + 1}</span>
          <span class="bar-slot-val note-label-text">${chordLabel(c, k)}</span><span class="note-ear-dot"></span></button>`;
      })
      .join('');
    const cur = this.s.values.chords[f.bar]!;
    $('chordRootLabel').textContent = noteName(cur.root, k);
    const active = this.s.stage === 1 && !this.s.pendingTheory;
    $('chordQualityRow').innerHTML = EDITABLE_QUALITIES.map(
      (q) => `<button type="button" class="keycap-btn keycap-btn--flex ${cur.quality === q ? 'is-active' : ''}" data-chord-qual="${q}" ${active ? '' : 'disabled'}>${QUALITY_KEYCAP[q]}</button>`,
    ).join('');
    $<HTMLButtonElement>('chordRootPrev').disabled = !active;
    $<HTMLButtonElement>('chordRootNext').disabled = !active;
  }

  private renderBass(): void {
    const p = this.p;
    const f = p.bassFault;
    const k = p.groove.keyPc;
    const L = this.s.layers.bass;
    const broken = L.status === 'active' || this.healingLayer === 'bass';
    $('chordRefStrip').innerHTML = this.s.values.chords
      .map((c) => `<div class="chord-ref-cell"><span class="note-label-text">${chordLabel(c, k)}</span><span class="note-ear-dot"></span></div>`)
      .join('');
    $('bassGrid').innerHTML = this.s.values.bass
      .map((m, i) => {
        const isFault = i === f.bar;
        const cls = ['bar-slot-card', isFault && broken ? 'is-broken is-selected' : '', !isFault ? 'is-locked-bar' : ''].join(' ');
        return `<button type="button" class="${cls}" data-bass-slot="${i}" data-bar-of="${i}">
          <span class="bar-slot-tag">BAR ${i + 1}</span>
          <span class="bar-slot-val note-label-text">${midiName(m, k)}</span><span class="note-ear-dot"></span></button>`;
      })
      .join('');
    const cur = this.s.values.bass[f.bar]!;
    const active = this.s.stage === 2 && !this.s.pendingTheory;
    const roles = { root: 'Root', third: '3rd', fifth: '5th' } as const;
    document.querySelectorAll<HTMLButtonElement>('[data-bass-pick]').forEach((btn) => {
      const role = btn.dataset.bassPick as keyof typeof roles;
      const midi = f.chips[role];
      btn.innerHTML = `${roles[role]}&nbsp;<span class="note-label-text bass-chip-note">(${midiName(midi, k)})</span>`;
      btn.classList.toggle('is-active', cur === midi);
      btn.disabled = !active;
    });
    $<HTMLButtonElement>('bassDownBtn').disabled = !active || cur <= f.min;
    $<HTMLButtonElement>('bassUpBtn').disabled = !active || cur >= f.max;
  }

  private renderCadence(): void {
    const p = this.p;
    const k = p.groove.keyPc;
    const L = this.s.layers.cadence;
    const broken = L.status === 'active' || this.healingLayer === 'cadence';
    $('cadenceGrid').innerHTML = this.s.values.chords
      .map((c, i) => {
        const locked = i < 3;
        const cls = ['bar-slot-card', locked ? 'is-locked-bar' : 'is-selected', !locked && broken ? 'is-broken' : ''].join(' ');
        return `<button type="button" class="${cls}" data-cadence-slot="${i}" data-bar-of="${i}">
          <span class="bar-slot-tag">${locked ? 'LOCKED' : 'BAR 4'}</span>
          <span class="bar-slot-val note-label-text" style="font-size:12px;">${chordLabel(c, k)}</span><span class="note-ear-dot"></span></button>`;
      })
      .join('');
    const active = this.s.stage === 3 && !this.s.pendingTheory;
    $('cadenceOptions').innerHTML = p.cadenceFault.candidates
      .map(
        (o, i) => `<button type="button" class="cadence-option ${this.s.cadenceIdx === i ? 'is-active' : ''}" data-cadence-pick="${i}" ${active ? '' : 'disabled'}>
          <span class="cadence-option-letter">OPTION ${'ABCD'[i]}</span>
          <span class="cadence-option-title note-label-text">${esc(o.label)}</span>
          <span class="cadence-option-sub note-label-text">${esc(o.roman)} in ${keyShort(k)}</span></button>`,
      )
      .join('');
  }

  private renderVictory(): void {
    if (!isVictory(this.s)) return;
    const summary = summarize(this.p, this.s);
    const streak = displayStreak(this.save.stats, this.p.dateIso);
    $('victoryTitle').textContent = STAMP_TITLE[summary.stampId];
    const stamp = STAMPS[summary.stampId];
    $<HTMLImageElement>('victoryStampImg').src = stamp.src;
    $<HTMLImageElement>('victoryStampImg').alt = `${stamp.name} seal`;
    $('victoryMetrics').textContent = `Precision: ${summary.totalTaps}/4 taps · Theory Aces: ${summary.theoryAces}/4 ⭐ · Streak: ${streak}d`;
    $('abBeforeBtn').className = `ab-btn ${this.abMode === 'before' ? 'is-before-active' : ''}`;
    $('abAfterBtn').className = `ab-btn ${this.abMode === 'after' ? 'is-after-active' : ''}`;
    $('abBeforeBtn').setAttribute('aria-pressed', String(this.abMode === 'before'));
    $('abAfterBtn').setAttribute('aria-pressed', String(this.abMode === 'after'));
    $('sharePreviewText').textContent = buildShare(this.p, summary).shareText;
  }

  private renderDock(): void {
    const victory = isVictory(this.s);
    const playing = this.engine.isPlaying;
    const play = $('playPauseBtn');
    play.classList.toggle('is-playing', playing);
    play.setAttribute('aria-label', playing ? 'Pause loop' : 'Play loop');
    play.innerHTML = playing ? ICONS.pause : ICONS.play;
    $('soloMixBtn').classList.toggle('is-selected', this.mixMode === 'solo');
    $('fullMixBtn').classList.toggle('is-selected', this.mixMode === 'mix');
    $('soloMixBtn').setAttribute('aria-pressed', String(this.mixMode === 'solo'));
    $('fullMixBtn').setAttribute('aria-pressed', String(this.mixMode === 'mix'));
    $<HTMLButtonElement>('soloMixBtn').disabled = victory;
    $('checkCtaLabel').textContent = victory ? 'Share Results' : 'Check Fix';
    $('checkIcon').innerHTML = victory ? ICONS.share : ICONS.healedCheck;
    $<HTMLButtonElement>('checkFixBtn').disabled = !victory && !!this.s.pendingTheory;
    const sound = $('soundToggleBtn');
    const off = this.muted || this.engine.status === 'locked';
    sound.innerHTML = off ? ICONS.soundMuted : ICONS.soundOn;
    sound.classList.toggle('is-muted', off);
    sound.setAttribute('aria-label', off ? 'Turn sound on' : 'Mute sound');
  }

  private renderStats(): void {
    const st = this.save.stats;
    const streak = displayStreak(st, this.p.dateIso);
    const clean = st.totalLayers ? Math.round((st.cleanLayers / st.totalLayers) * 100) : 0;
    const avg = st.played ? (st.totalTaps / st.played).toFixed(1) : '—';
    const kpis: [string, string][] = [
      [String(st.played), 'Restored'],
      [String(streak), 'Streak'],
      [String(st.bestStreak), 'Best'],
      [st.totalLayers ? `${clean}%` : '—', 'Clean Fix'],
      [avg, 'Avg Taps'],
      [String(st.theoryAces), 'Theory ⭐'],
    ];
    $('statsKpis').innerHTML = kpis.map(([v, l]) => `<div class="kpi-box"><div class="kpi-val">${v}</div><div class="kpi-label">${l}</div></div>`).join('');
    const today = this.save.days[this.p.dateIso]?.summary;
    const todayIdx = today ? Math.min(4, today.totalTaps - 4) : -1;
    const max = Math.max(1, ...st.tapDist);
    $('statsDist').innerHTML = st.played
      ? st.tapDist
          .map((n, i) => `<div class="dist-row ${i === todayIdx ? 'is-today' : ''}"><span>${i === 4 ? '8+' : 4 + i}/4</span><div class="dist-track"><div class="dist-fill" style="width:${(n / max) * 100}%"></div></div><span>${n}</span></div>`)
          .join('')
      : '<p class="stats-empty">Restore your first track to start the telemetry log.</p>';
    $('statsSeals').innerHTML = STAMP_ORDER.map((id) => {
      const earned = st.seals.includes(id);
      return `<div class="badge-item ${earned ? '' : 'is-unearned'}"><img src="${STAMPS[id].src}" alt="${STAMPS[id].name}${earned ? '' : ' (locked)'}" /><span>${earned ? STAMPS[id].name : `🔒 ${STAMPS[id].name}`}</span></div>`;
    }).join('');
  }

  // ---------------------------------------------------------------------------
  // Theory sheet
  // ---------------------------------------------------------------------------

  private openTheorySheet(layer: LayerId): void {
    const q = this.p.stages[LAYERS.indexOf(layer)]!.theoryBonus;
    this.theoryRevealed = false;
    $('theoryPrompt').textContent = q.prompt;
    $('theoryOptions').innerHTML = q.options
      .map((opt, i) => `<button type="button" class="theory-pill" data-theory-opt="${i}">${esc(opt)}</button>`)
      .join('');
    $('theoryExplain').hidden = true;
    $('theoryStatusPill').className = `status-pill status-pill--${this.s.layers[layer].tries === 1 ? 'healed' : 'patched'}`;
    $('theoryStatusPill').textContent = this.s.layers[layer].tries === 1 ? 'Clean Fix' : 'Layer Patched';
    $('theorySkipBtn').textContent = layer === 'cadence' ? 'Skip → See Results' : 'Skip → Next Layer';
    $('theorySheet').classList.add('is-open');
  }

  private answer(idx: number): void {
    if (this.theoryRevealed || !this.s.pendingTheory) return;
    const layer = this.s.pendingTheory;
    const q = this.p.stages[LAYERS.indexOf(layer)]!.theoryBonus;
    const correct = answerTheory(this.p, this.s, idx);
    if (correct === null) return;
    this.theoryRevealed = true;
    document.querySelectorAll<HTMLButtonElement>('[data-theory-opt]').forEach((b, i) => {
      b.disabled = true;
      if (i === q.correctIndex) b.classList.add('is-correct');
      else if (i === idx) b.classList.add('is-wrong');
    });
    if (correct) document.querySelector(`[data-theory-opt="${idx}"]`)?.insertAdjacentHTML('beforeend', '<span class="star-badge is-pop">⭐</span>');
    $('theoryExplain').textContent = q.explanation;
    $('theoryExplain').hidden = false;
    $('theorySkipBtn').textContent = layer === 'cadence' ? 'See Results →' : 'Continue → Next Layer';
    this.persist();
    this.ensureWinRecorded();
    this.hooks.onTheoryBonus(layer, correct);
  }

  private closeTheory(): void {
    if (!this.theoryRevealed) skipTheory(this.s);
    this.theoryRevealed = false;
    $('theorySheet').classList.remove('is-open');
    this.afterAdvance();
  }

  private afterAdvance(): void {
    this.engine.setFocus(this.mixMode, activeLayer(this.s));
    this.persist();
    this.render();
    if (isVictory(this.s)) this.hooks.onAllRestored(summarize(this.p, this.s));
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  private edited(layer: LayerId, slot: number, preview: () => void): void {
    this.syncAudio();
    this.render();
    this.hooks.onAuditionChange(layer, slot);
    preview();
    this.persist();
  }

  private handleCheck(): void {
    if (isVictory(this.s)) {
      this.openModal('shareModal');
      return;
    }
    const res = checkFix(this.p, this.s, this.save.settings.noteLabels === 'show');
    if (!res) return;
    this.persist();
    const slot = this.p.stages[LAYERS.indexOf(res.layer)]!.faultySlotIndex;
    if (res.ok) {
      this.healingLayer = res.layer; // stay coral until the sweep's midpoint
      this.render();
      this.hooks.onLayerMended(res.layer, res.tries);
    } else {
      this.render();
      this.hooks.onWrongAttempt(res.layer, slot);
    }
  }

  private togglePlay(): void {
    if (this.engine.isPlaying) this.engine.stop();
    else this.engine.play();
    this.renderDock();
  }

  private async unlock(withAudio: boolean): Promise<void> {
    this.closeModal('unlockOverlay');
    this.gateOpen = false;
    if (withAudio) {
      const ok = await this.engine.unlock();
      this.muted = !ok;
      if (!ok) this.toast('Audio unavailable — Visual Mode', 'warn');
      else this.toast(`Audio Bench Powered On · ${this.p.bpm} BPM`, 'ok');
    } else {
      this.muted = true;
      this.toast('Visual-Only Mode Active', 'ok');
    }
    this.engine.setMuted(this.muted);
    this.engine.setFocus(this.mixMode, activeLayer(this.s));
    this.syncAudio();
    this.engine.play();
    this.renderDock();
    this.measure();
    if (!this.save.settings.seenHelp) {
      this.save.settings.seenHelp = true;
      writeSave(this.save);
      this.openModal('helpModal');
    }
  }

  private async toggleSound(): Promise<void> {
    if (this.engine.status === 'locked') {
      const wasPlaying = this.engine.isPlaying;
      if (wasPlaying) this.engine.stop();
      const ok = await this.engine.unlock();
      this.muted = !ok;
      this.engine.setMuted(this.muted);
      this.engine.setFocus(this.mixMode, activeLayer(this.s));
      this.syncAudio();
      if (wasPlaying || !this.gateOpen) this.engine.play();
      this.toast(ok ? 'Audio Unmuted' : 'Audio unavailable on this device', ok ? 'ok' : 'warn');
    } else {
      this.muted = !this.muted;
      this.engine.setMuted(this.muted);
      this.toast(this.muted ? 'Audio Muted (Visual Mode)' : 'Audio Unmuted', 'ok');
    }
    this.renderDock();
  }

  private setMix(mode: MixMode): void {
    this.mixMode = mode;
    this.engine.setFocus(mode, activeLayer(this.s));
    this.render();
  }

  private setAB(mode: 'after' | 'before'): void {
    if (this.abMode === mode) return;
    this.abMode = mode;
    this.engine.swapValues(this.playbackValues());
    this.render();
    this.toast(mode === 'before' ? 'A/B: Original Broken Mix' : 'A/B: Restored Mix', mode === 'before' ? 'warn' : 'ok');
  }

  private auditionBar(bar: number): void {
    const c = this.s.values.chords[bar]!;
    this.engine.auditionChord(voiceChord(c), this.s.values.bass[bar]!);
  }

  private onSlotTap(layer: LayerId, slot: number): void {
    const active = activeLayer(this.s);
    if (layer === 'melody') {
      this.engine.audition('melody', [this.s.values.melody[slot]!], voiceChord(this.s.values.chords[Math.floor(this.p.groove.melody[slot]!.start / 16)]!));
    } else {
      this.auditionBar(slot);
    }
    this.hooks.onAuditionChange(layer, slot);
    const faultSlot = this.p.stages[LAYERS.indexOf(layer)]!.faultySlotIndex;
    if (active === layer && slot !== faultSlot && !this.s.pendingTheory) {
      this.toast(layer === 'cadence' ? 'Bars 1–3 are locked — fix Bar 4' : 'That one is healthy — the fault glows coral', 'ok');
    }
  }

  // ---------------------------------------------------------------------------
  // Modals & toast
  // ---------------------------------------------------------------------------

  private openModal(id: string): void {
    if (id === 'statsModal') this.renderStats();
    $(id).classList.add('is-open');
    $(id).querySelector<HTMLElement>('.close-btn, button')?.focus({ preventScroll: true });
  }

  private closeModal(id: string): void {
    $(id).classList.remove('is-open');
  }

  private toast(msg: string, kind: 'ok' | 'warn'): void {
    const el = $('toastBox');
    el.textContent = msg;
    el.className = `toast is-shown is-${kind}`;
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => el.classList.remove('is-shown'), 2400);
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  private bindEvents(): void {
    const on = (id: string, fn: (e: MouseEvent) => void) => $(id).addEventListener('click', fn);

    // The unlock MUST happen synchronously in this click (iOS Safari).
    on('unlockAudioBtn', () => void this.unlock(true));
    on('unlockMutedBtn', () => void this.unlock(false));
    on('resumeAudioPill', () => void this.engine.resume());
    on('soundToggleBtn', () => void this.toggleSound());
    on('helpBtn', () => this.openModal('helpModal'));
    on('statsBtn', () => this.openModal('statsModal'));
    on('settingsBtn', () => this.openModal('settingsModal'));
    on('openShareFromVictory', () => this.openModal('shareModal'));
    document.querySelectorAll<HTMLElement>('[data-close-modal]').forEach((b) => b.addEventListener('click', () => this.closeModal(b.dataset.closeModal!)));
    document.querySelectorAll<HTMLElement>('.overlay-backdrop').forEach((bd) =>
      bd.addEventListener('click', (e) => {
        if (e.target === bd && bd.id !== 'unlockOverlay') this.closeModal(bd.id);
      }),
    );

    on('copyShareBtn', () => {
      const text = $('sharePreviewText').textContent ?? '';
      const done = () => {
        $('copyShareBtn').textContent = '✓ Copied to Clipboard!';
        this.toast('Diagnostic card copied!', 'ok');
        window.setTimeout(() => ($('copyShareBtn').textContent = 'Copy Share Card'), 1800);
      };
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, () => this.fallbackCopy(text, done));
      else this.fallbackCopy(text, done);
    });

    on('themeDarkBtn', () => this.setTheme('dark'));
    on('themeLightBtn', () => this.setTheme('light'));
    on('labelsShowBtn', () => this.setNoteLabels('show'));
    on('labelsEarBtn', () => this.setNoteLabels('ear-only'));

    on('playPauseBtn', () => this.togglePlay());
    on('soloMixBtn', () => this.setMix('solo'));
    on('fullMixBtn', () => this.setMix('mix'));
    on('checkFixBtn', () => this.handleCheck());
    on('abBeforeBtn', () => this.setAB('before'));
    on('abAfterBtn', () => this.setAB('after'));

    // Stage 1
    $('melodyGrid').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-melody-slot]');
      if (b) this.onSlotTap('melody', Number(b.dataset.melodySlot));
    });
    const nudgeM = (dir: 1 | -1) => {
      if (this.s.stage !== 0 || this.s.pendingTheory) return;
      if (!nudgeMelody(this.p, this.s, dir)) return;
      const f = this.p.melodyFault;
      this.edited('melody', f.slot, () => this.engine.audition('melody', [this.s.values.melody[f.slot]!], voiceChord(this.p.groove.chords[f.bar]!)));
    };
    on('melodyDownBtn', () => nudgeM(-1));
    on('melodyUpBtn', () => nudgeM(1));

    // Stage 2
    $('chordsGrid').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-chord-slot]');
      if (b) this.onSlotTap('chords', Number(b.dataset.chordSlot));
    });
    const chordEdit = (fn: () => void) => {
      if (this.s.stage !== 1 || this.s.pendingTheory) return;
      fn();
      const bar = this.p.chordFault.bar;
      this.edited('chords', bar, () => this.auditionBar(bar));
    };
    on('chordRootPrev', () => chordEdit(() => stepChordRoot(this.p, this.s, -1)));
    on('chordRootNext', () => chordEdit(() => stepChordRoot(this.p, this.s, 1)));
    $('chordQualityRow').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-chord-qual]');
      if (b) chordEdit(() => setChordQuality(this.p, this.s, b.dataset.chordQual as EditableQuality));
    });

    // Stage 3
    $('bassGrid').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-bass-slot]');
      if (b) this.onSlotTap('bass', Number(b.dataset.bassSlot));
    });
    const bassEdit = (fn: () => boolean | void) => {
      if (this.s.stage !== 2 || this.s.pendingTheory) return;
      if (fn() === false) return;
      const bar = this.p.bassFault.bar;
      this.edited('bass', bar, () => this.engine.audition('bass', [this.s.values.bass[bar]!], voiceChord(this.s.values.chords[bar]!)));
    };
    on('bassDownBtn', () => bassEdit(() => nudgeBass(this.p, this.s, -1)));
    on('bassUpBtn', () => bassEdit(() => nudgeBass(this.p, this.s, 1)));
    document.querySelectorAll<HTMLElement>('[data-bass-pick]').forEach((btn) =>
      btn.addEventListener('click', () => bassEdit(() => setBass(this.p, this.s, this.p.bassFault.chips[btn.dataset.bassPick as 'root' | 'third' | 'fifth']))),
    );

    // Stage 4
    $('cadenceGrid').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-cadence-slot]');
      if (b) this.onSlotTap('cadence', Number(b.dataset.cadenceSlot));
    });
    $('cadenceOptions').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-cadence-pick]');
      if (!b || this.s.stage !== 3 || this.s.pendingTheory) return;
      pickCadence(this.p, this.s, Number(b.dataset.cadencePick));
      this.edited('cadence', 3, () => this.auditionBar(3));
    });

    // Theory sheet
    $('theoryOptions').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-theory-opt]');
      if (b) this.answer(Number(b.dataset.theoryOpt));
    });
    on('theorySkipBtn', () => this.closeTheory());

    // Keyboard: Space = play/pause, ↑/↓ = nudge, Enter = check, Esc = close modal.
    document.addEventListener('keydown', (e) => {
      const target = e.target as HTMLElement;
      if (e.key === 'Escape') {
        document.querySelectorAll<HTMLElement>('.overlay-backdrop.is-open').forEach((m) => {
          if (m.id !== 'unlockOverlay') this.closeModal(m.id);
        });
        return;
      }
      if (this.gateOpen || document.querySelector('.overlay-backdrop.is-open')) return;
      if (target.tagName === 'BUTTON' && (e.key === 'Enter' || e.key === ' ')) return;
      if (e.key === ' ') {
        e.preventDefault();
        this.togglePlay();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const dir = e.key === 'ArrowUp' ? 1 : -1;
        if (this.s.stage === 0) nudgeM(dir);
        else if (this.s.stage === 2) bassEdit(() => nudgeBass(this.p, this.s, dir));
        else return;
        e.preventDefault();
      } else if (e.key === 'Enter') {
        this.handleCheck();
      }
    });
  }

  private fallbackCopy(text: string, done: () => void): void {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } catch {
      /* ignore */
    }
    ta.remove();
    done();
  }
}
