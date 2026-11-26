import '../design/tokens.css';
import './styles/app.css';
import { localDateIso } from './core/daily';
import { generatePuzzle } from './core/puzzle';
import { MendApp } from './ui/app';

/** Dev-only: ?day=YYYY-MM-DD previews another day's puzzle. Production always plays today (local day). */
function puzzleDate(): string {
  if (import.meta.env.DEV) {
    const day = new URLSearchParams(location.search).get('day');
    if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) return day;
  }
  return localDateIso();
}

const date = puzzleDate();
new MendApp(generatePuzzle(date)).mount();

// Roll over to the new daily puzzle after local midnight (tab left open overnight). Progress is
// saved per day, so reloading when the player returns to the tab is safe. Skipped for ?day= previews.
if (date === localDateIso()) {
  const onReturn = () => {
    if (document.visibilityState === 'visible' && localDateIso() !== date) location.reload();
  };
  document.addEventListener('visibilitychange', onReturn);
  window.addEventListener('focus', onReturn);
}
