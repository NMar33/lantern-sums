import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sumOf, checkSelection, scoreFor } from '../logic.js';

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
