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
