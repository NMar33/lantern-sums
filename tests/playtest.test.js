import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLAYER, playAll, playLevel, report } from '../tools/playtest.js';

const ghostLosses = (run) => run.livesLost.filter((l) => l.cause.includes('ghost')).length;

test('the same seed plays the same game', () => {
  assert.deepEqual(playLevel({ level: 2, seed: 7 }), playLevel({ level: 2, seed: 7 }));
  assert.deepEqual(
    playLevel({ level: 1, theme: 'halloween', seed: 3 }),
    playLevel({ level: 1, theme: 'halloween', seed: 3 }),
  );
});

test('a level ends passed at 200 points or failed with 3 lives lost', () => {
  for (const run of playAll({ levels: 6, seed: 1 })) {
    if (run.result === 'passed') assert.ok(run.score >= 200);
    if (run.result === 'failed') assert.equal(run.livesLost.length, 3);
    assert.ok(run.livesLost.length <= 3);
  }
});

test('the classic theme never loses a life to a ghost', () => {
  for (let seed = 1; seed <= 5; seed++) {
    for (const run of playAll({ levels: 3, themes: ['classic'], seed })) {
      assert.equal(ghostLosses(run), 0);
    }
  }
});

test('a player who always spots ghosts never loses a life to one', () => {
  const player = { ...PLAYER, ghostMiss: 0 };
  for (let seed = 1; seed <= 5; seed++) {
    for (const run of playAll({ levels: 3, themes: ['halloween'], seed, player })) {
      assert.equal(ghostLosses(run), 0);
    }
  }
});

test('a player who never spots ghosts loses lives to them', () => {
  const player = { ...PLAYER, ghostMiss: 1 };
  const runs = [1, 2, 3].flatMap((seed) =>
    playAll({ levels: 2, themes: ['halloween'], seed, player }),
  );
  assert.ok(runs.reduce((n, run) => n + ghostLosses(run), 0) > 0);
});

test('the report has a row per level and theme', () => {
  const text = report(playAll({ levels: 3, seed: 1 }));
  assert.match(text, /## Classic/);
  assert.match(text, /## Halloween/);
  assert.equal(text.match(/^\| \d+ \|/gm).length, 6);
});
