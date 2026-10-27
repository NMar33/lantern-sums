export const TARGET = 10;
export const UNLOCK_POINTS = 100; // unlocks the next level, after game over
export const ADVANCE_POINTS = 200; // moves on to the next level at once

// Each step makes one thing harder: faster lanterns, more of them, then a
// bigger target. A bigger target allows more groups of 3 and 4, which score
// more, so those levels also rise much faster; the speeds come from the
// playtest bot (tools/playtest.js), so each level is passed less often than
// the one before. Past the last row the lanterns keep getting faster.
const LEVELS = [
  { speed: 40, interval: 1.2, target: 10 },
  { speed: 50, interval: 1.2, target: 10 },
  { speed: 50, interval: 1.0, target: 10 },
  { speed: 90, interval: 1.0, target: 12 },
  { speed: 100, interval: 1.0, target: 15 },
];
const SPEED_STEP = 10; // px per second added per level past the table

export function levelSettings(level) {
  const n = Math.max(1, Math.floor(level));
  const last = LEVELS[LEVELS.length - 1];
  if (n <= LEVELS.length) return { ...LEVELS[n - 1] };
  return { ...last, speed: last.speed + SPEED_STEP * (n - LEVELS.length) };
}

export function sumOf(numbers) {
  return numbers.reduce((total, n) => total + n, 0);
}

export function checkSelection(numbers, target = TARGET) {
  const total = sumOf(numbers);
  if (total === target) return 'match';
  return total > target ? 'over' : 'under';
}

export function scoreFor(count) {
  if (count >= 4) return 60;
  if (count === 3) return 30;
  if (count === 2) return 10;
  return 0;
}

// The highest level a player may start, given the one played and its score.
export function unlockedAfter(level, score, unlocked) {
  return score >= UNLOCK_POINTS ? Math.max(unlocked, level + 1) : unlocked;
}

// Halloween mode is on by itself from Oct 25 to Nov 1, by the local date.
export function isHalloweenSeason(date) {
  const month = date.getMonth(); // 0 = January
  const day = date.getDate();
  return (month === 9 && day >= 25) || (month === 10 && day === 1);
}

// The theme a link asks for ('halloween' or 'classic'), or null.
export function themeFromLink(search) {
  const theme = new URLSearchParams(search).get('theme');
  return theme === 'halloween' || theme === 'classic' ? theme : null;
}

// Strongest first: the link, then the remembered toggle (true, false or
// null when never set), then the date.
export function halloweenOn({ date, search = '', remembered = null }) {
  const link = themeFromLink(search);
  if (link) return link === 'halloween';
  if (remembered !== null) return remembered;
  return isHalloweenSeason(date);
}

// What a selection of lanterns ({ value, ghost }) does: 'match' and 'over'
// resolve it, 'under' waits for more. A ghost in a resolved selection costs
// one life and the selection scores nothing.
export function selectionOutcome(lanterns, target = TARGET) {
  const result = checkSelection(lanterns.map((l) => l.value), target);
  if (result === 'under') return { result, points: 0, livesLost: 0 };
  if (lanterns.some((l) => l.ghost)) return { result, points: 0, livesLost: 1 };
  const points = result === 'match' ? scoreFor(lanterns.length) : 0;
  return { result, points, livesLost: 0 };
}

// Lives a lantern costs when it reaches the top: a ghost flies away freely.
export function escapeCost(lantern) {
  return lantern.ghost ? 0 : 1;
}
