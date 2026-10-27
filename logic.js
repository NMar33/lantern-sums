export const TARGET = 10;
export const UNLOCK_POINTS = 100; // unlocks the next level, after game over
export const ADVANCE_POINTS = 200; // moves on to the next level at once

// Each step makes one thing harder: faster lanterns, more of them, then a
// bigger target. Past the last row the lanterns keep getting faster.
const LEVELS = [
  { speed: 40, interval: 1.2, target: 10 },
  { speed: 50, interval: 1.2, target: 10 },
  { speed: 50, interval: 1.0, target: 10 },
  { speed: 50, interval: 1.0, target: 12 },
  { speed: 50, interval: 1.0, target: 15 },
];
const SPEED_STEP = 5; // px per second added per level past the table

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
