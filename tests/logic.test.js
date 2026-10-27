import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sumOf,
  checkSelection,
  scoreFor,
  isHalloweenSeason,
  themeFromLink,
  halloweenOn,
} from '../logic.js';

test('sumOf adds the numbers', () => {
  assert.equal(sumOf([]), 0);
  assert.equal(sumOf([4]), 4);
  assert.equal(sumOf([3, 7]), 10);
  assert.equal(sumOf([1, 2, 3, 4]), 10);
  assert.equal(sumOf([9, 9, 9]), 27);
});

test('sumOf does not change its input', () => {
  const numbers = [2, 8];
  sumOf(numbers);
  assert.deepEqual(numbers, [2, 8]);
});

test('checkSelection returns "match" when the sum is 10', () => {
  assert.equal(checkSelection([10]), 'match');
  assert.equal(checkSelection([3, 7]), 'match');
  assert.equal(checkSelection([2, 3, 5]), 'match');
  assert.equal(checkSelection([1, 2, 3, 4]), 'match');
});

test('checkSelection returns "over" when the sum is above 10', () => {
  assert.equal(checkSelection([6, 5]), 'over');
  assert.equal(checkSelection([11]), 'over');
  assert.equal(checkSelection([9, 9, 9]), 'over');
});

test('checkSelection returns "under" when the sum is below 10', () => {
  assert.equal(checkSelection([2, 3]), 'under');
  assert.equal(checkSelection([9]), 'under');
  assert.equal(checkSelection([]), 'under');
});

test('scoreFor pays 10 for two lanterns', () => {
  assert.equal(scoreFor(2), 10);
});

test('scoreFor pays 30 for three lanterns', () => {
  assert.equal(scoreFor(3), 30);
});

test('scoreFor pays 60 for four or more lanterns', () => {
  assert.equal(scoreFor(4), 60);
  assert.equal(scoreFor(5), 60);
  assert.equal(scoreFor(9), 60);
});

// Months are 0-based in Date: 9 is October, 10 is November.
const oct = (day) => new Date(2026, 9, day);

test('Halloween season runs from Oct 25 to Nov 1', () => {
  assert.equal(isHalloweenSeason(oct(24)), false);
  assert.equal(isHalloweenSeason(oct(25)), true);
  assert.equal(isHalloweenSeason(oct(31)), true);
  assert.equal(isHalloweenSeason(new Date(2026, 10, 1)), true);
  assert.equal(isHalloweenSeason(new Date(2026, 10, 2)), false);
});

test('Halloween season comes back every year', () => {
  assert.equal(isHalloweenSeason(new Date(2031, 9, 28)), true);
});

test('themeFromLink reads ?theme= and ignores other values', () => {
  assert.equal(themeFromLink('?theme=halloween'), 'halloween');
  assert.equal(themeFromLink('?theme=classic'), 'classic');
  assert.equal(themeFromLink('?theme=space'), null);
  assert.equal(themeFromLink(''), null);
});

test('halloweenOn follows the date when nothing else is set', () => {
  assert.equal(halloweenOn({ date: oct(31) }), true);
  assert.equal(halloweenOn({ date: new Date(2026, 5, 15) }), false);
});

test('?theme=halloween turns it on in June', () => {
  const june = new Date(2026, 5, 15);
  assert.equal(halloweenOn({ date: june, search: '?theme=halloween' }), true);
});

test('?theme=classic turns it off on Oct 31', () => {
  assert.equal(halloweenOn({ date: oct(31), search: '?theme=classic' }), false);
});

test('a remembered toggle "off" turns it off on Oct 31', () => {
  assert.equal(halloweenOn({ date: oct(31), remembered: false }), false);
});

test('a remembered toggle "on" turns it on in June', () => {
  const june = new Date(2026, 5, 15);
  assert.equal(halloweenOn({ date: june, remembered: true }), true);
});

test('the link wins over the remembered toggle', () => {
  assert.equal(
    halloweenOn({ date: oct(31), search: '?theme=halloween', remembered: false }),
    true,
  );
  assert.equal(
    halloweenOn({ date: oct(31), search: '?theme=classic', remembered: true }),
    false,
  );
});
