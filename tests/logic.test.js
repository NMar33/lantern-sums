import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TARGET,
  UNLOCK_POINTS,
  ADVANCE_POINTS,
  levelSettings,
  sumOf,
  checkSelection,
  scoreFor,
  unlockedAfter,
} from '../logic.js';

test('the target is 10', () => {
  assert.equal(TARGET, 10);
});

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

test('scoreFor pays nothing for zero or one lantern', () => {
  assert.equal(scoreFor(0), 0);
  assert.equal(scoreFor(1), 0);
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

test('checkSelection uses the target it is given', () => {
  assert.equal(checkSelection([5, 7], 12), 'match');
  assert.equal(checkSelection([3, 7], 12), 'under');
  assert.equal(checkSelection([9, 7], 15), 'over');
  assert.equal(checkSelection([6, 9], 15), 'match');
});

test('level 1 is the original game', () => {
  assert.deepEqual(levelSettings(1), { speed: 40, interval: 1.2, target: 10 });
});

test('levels get faster, then more lanterns, then a bigger target', () => {
  const [l1, l2, l3, l4, l5] = [1, 2, 3, 4, 5].map(levelSettings);
  assert.ok(l2.speed > l1.speed);
  assert.ok(l3.interval < l2.interval);
  assert.equal(l3.target, 10);
  assert.equal(l4.target, 12);
  assert.equal(l5.target, 15);
});

test('levels past the table keep getting faster with target 15', () => {
  assert.ok(levelSettings(6).speed > levelSettings(5).speed);
  assert.ok(levelSettings(7).speed > levelSettings(6).speed);
  assert.equal(levelSettings(9).target, 15);
});

test('unlock at 100 points and advance at 200', () => {
  assert.equal(UNLOCK_POINTS, 100);
  assert.equal(ADVANCE_POINTS, 200);
});

test('unlockedAfter opens the next level from 100 points', () => {
  assert.equal(unlockedAfter(1, 90, 1), 1);
  assert.equal(unlockedAfter(1, 100, 1), 2);
  assert.equal(unlockedAfter(2, 150, 2), 3);
});

test('unlockedAfter never closes a level already open', () => {
  assert.equal(unlockedAfter(1, 0, 4), 4);
  assert.equal(unlockedAfter(1, 120, 4), 4);
});
