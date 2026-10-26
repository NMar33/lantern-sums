export const TARGET = 10;

export function sumOf(numbers) {
  return numbers.reduce((total, n) => total + n, 0);
}

export function checkSelection(numbers) {
  const total = sumOf(numbers);
  if (total === TARGET) return 'match';
  return total > TARGET ? 'over' : 'under';
}

export function scoreFor(count) {
  if (count >= 4) return 60;
  if (count === 3) return 30;
  if (count === 2) return 10;
  return 0;
}
