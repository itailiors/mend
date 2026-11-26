import '../design/tokens.css';
import './styles/app.css';
import { utcDateIso } from './core/daily';
import { generatePuzzle } from './core/puzzle';
import { MendApp } from './ui/app';

/** Dev-only: ?day=YYYY-MM-DD previews another day's puzzle. Production always plays today (UTC). */
function puzzleDate(): string {
  if (import.meta.env.DEV) {
    const day = new URLSearchParams(location.search).get('day');
    if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) return day;
  }
  return utcDateIso();
}

new MendApp(generatePuzzle(puzzleDate())).mount();
