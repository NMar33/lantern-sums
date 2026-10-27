// Playtest bot: plays each level with no screen, at human speed, and reports
// where it loses lives. Run: node tools/playtest.js [--seed 1] [--levels 6]
// [--theme both|classic|halloween] [--out playtest-report.md]
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  ADVANCE_POINTS,
  UNLOCK_POINTS,
  escapeCost,
  levelSettings,
  selectionOutcome,
} from '../logic.js';

// The sky's physics and ghost spawning, copied from game.js: keep these in
// step with it. The scoring and ghost rules come from logic.js.
const LANTERN_RADIUS = 45;
const LANTERN_GAP = 8;
const SPAWN_TRIES = 20;
const FLOAT_TIME = 0.8;
const LIVES = 3;
const GHOST_CHANCE = 1 / 7; // after a normal lantern: about 1 in 8 overall

// A human-like player: it needs time to spot a group and to click it, and
// it only looks at the highest few lanterns.
export const PLAYER = {
  scanTime: 0.8, // seconds to spot a group after the last one
  clickTime: 0.35, // seconds between two clicks in a group
  retryTime: 0.3, // seconds before looking again when nothing adds up
  attention: 8, // highest lanterns the player looks at
  maxGroup: 4,
  ghostMiss: 0.15, // chance to take a ghost for a normal lantern
};

export const SCREEN = { width: 1280, height: 800, hud: 140 };

const STEP = 0.05; // seconds per simulated frame
const TIME_LIMIT = 600; // seconds of play before a level is called off
const CROWDED = 10; // lanterns in the sky at once

// Small seeded generator (mulberry32), so a run can be repeated.
function randomFrom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function playLevel({
  level,
  theme = 'classic',
  seed = 1,
  player = PLAYER,
  screen = SCREEN,
  settings = levelSettings(level), // override to try other speeds
}) {
  const skyRandom = randomFrom(seed * 1000 + level);
  const botRandom = randomFrom(seed * 1000 + level + 500);
  const halloween = theme === 'halloween';

  let lanterns = [];
  let nextId = 1;
  let lastGhost = false;
  let spawnTimer = settings.interval;
  let score = 0;
  let lives = LIVES;
  let t = 0;
  let plan = [];
  let selected = [];
  let botTimer = player.scanTime;
  let unlockedAt = null;
  let crowdedAt = null;
  let mostInSky = 0;
  const noticed = new Map(); // ghost id -> whether the player saw it is a ghost
  const livesLost = [];
  let result = 'stopped';

  const inSky = () => lanterns.filter((l) => l.floatT === null);

  function spawn() {
    const margin = LANTERN_RADIUS + LANTERN_GAP;
    const minDistance = 2 * LANTERN_RADIUS + LANTERN_GAP;
    const y = screen.height + LANTERN_RADIUS;
    for (let i = 0; i < SPAWN_TRIES; i++) {
      const x = margin + skyRandom() * (screen.width - 2 * margin);
      if (lanterns.some((l) => Math.hypot(l.x - x, l.y - y) < minDistance)) continue;
      const value = 1 + Math.floor(skyRandom() * 9);
      const ghost = halloween && !lastGhost && skyRandom() < GHOST_CHANCE;
      lastGhost = ghost;
      lanterns.push({ id: nextId++, x, y, value, ghost, floatT: null });
      return;
    }
  }

  function loseLives(n, cause) {
    for (let i = 0; i < n; i++) {
      lives -= 1;
      livesLost.push({ t, cause, inSky: inSky().length });
    }
  }

  // Groups of 2 to maxGroup lanterns adding up to the target among the
  // highest visible ones, leaving out ghosts the player noticed. The group
  // whose top lantern is highest wins: it saves the lantern closest to
  // escaping.
  function findGroup() {
    const top = screen.hud + LANTERN_RADIUS;
    const bottom = screen.height - LANTERN_RADIUS;
    const candidates = inSky()
      .filter((l) => l.y >= top && l.y <= bottom)
      .sort((a, b) => a.y - b.y)
      .slice(0, player.attention)
      .filter((l) => {
        if (!l.ghost) return true;
        if (!noticed.has(l.id)) noticed.set(l.id, botRandom() >= player.ghostMiss);
        return !noticed.get(l.id);
      });

    let best = null;
    const group = [];
    function search(start, total) {
      if (total === settings.target && group.length >= 2) {
        if (!best || group[0].y < best[0].y) best = [...group];
        return;
      }
      if (total >= settings.target || group.length === player.maxGroup) return;
      for (let i = start; i < candidates.length; i++) {
        group.push(candidates[i]);
        search(i + 1, total + candidates[i].value);
        group.pop();
      }
    }
    search(0, 0);
    return best ? best.map((l) => l.id) : [];
  }

  // As in the game: a ghost in the sum costs a life, flashes and stays in
  // the sky; after that the player knows it is a ghost.
  function resolve() {
    const { result, points, livesLost: lost } = selectionOutcome(selected, settings.target);
    if (result === 'under') return false;
    if (lost > 0) {
      loseLives(lost, `a ghost was in the sum ${selected.map((l) => l.value).join(' + ')}`);
      for (const l of selected) if (l.ghost) noticed.set(l.id, true);
    } else if (result === 'match') {
      score += points;
      for (const l of selected) l.floatT = 0;
    }
    selected = [];
    return true;
  }

  function botStep() {
    botTimer -= STEP;
    if (botTimer > 0) return;

    if (plan.length === 0) {
      plan = findGroup();
      if (plan.length === 0) {
        botTimer = player.retryTime;
        return;
      }
    }

    const lantern = inSky().find((l) => l.id === plan[0]);
    if (!lantern) {
      // A planned lantern escaped: drop the half-made selection, look again.
      selected = [];
      plan = [];
      botTimer = player.retryTime;
      return;
    }
    plan.shift();
    selected.push(lantern);
    const resolved = resolve();
    botTimer = resolved || plan.length === 0 ? player.scanTime : player.clickTime;
    if (resolved) plan = [];
  }

  while (t < TIME_LIMIT) {
    t += STEP;

    spawnTimer += STEP;
    while (spawnTimer >= settings.interval) {
      spawnTimer -= settings.interval;
      spawn();
    }

    for (const l of lanterns) {
      l.y -= settings.speed * STEP;
      if (l.floatT !== null) l.floatT += STEP;
    }

    botStep();
    if (unlockedAt === null && score >= UNLOCK_POINTS) unlockedAt = t;
    if (score >= ADVANCE_POINTS) {
      result = 'passed';
      break;
    }

    // Lanterns whose top edge reaches the top of the sky.
    const escaped = [];
    lanterns = lanterns.filter((l) => {
      if (l.floatT !== null) return l.floatT < FLOAT_TIME;
      if (l.y - LANTERN_RADIUS <= 0) {
        escaped.push(l);
        return false;
      }
      return true;
    });
    selected = selected.filter((l) => !escaped.includes(l));
    for (const l of escaped) loseLives(escapeCost(l), `a ${l.value} reached the top`);

    const count = inSky().length;
    mostInSky = Math.max(mostInSky, count);
    if (crowdedAt === null && count >= CROWDED) crowdedAt = t;

    if (lives <= 0) {
      result = 'failed';
      break;
    }
  }

  return {
    level,
    theme,
    target: settings.target,
    score,
    result,
    time: t,
    unlockedAt,
    crowdedAt,
    mostInSky,
    livesLost,
  };
}

export function playAll({ levels = 6, themes = ['classic', 'halloween'], seed = 1, player, screen } = {}) {
  const runs = [];
  for (const theme of themes) {
    for (let level = 1; level <= levels; level++) {
      runs.push(playLevel({ level, theme, seed, player, screen }));
    }
  }
  return runs;
}

function clock(seconds) {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function resultText(run) {
  if (run.result === 'passed') return `passed (${ADVANCE_POINTS} at ${clock(run.time)})`;
  const end = run.result === 'failed' ? `failed at ${clock(run.time)}` : `stopped at ${clock(run.time)}`;
  return run.unlockedAt === null ? end : `${end}, next level unlocked at ${clock(run.unlockedAt)}`;
}

export function report(runs, { seed = 1, player = PLAYER, screen = SCREEN } = {}) {
  const lines = [
    '# Lantern Sums playtest',
    '',
    `Seed ${seed}. Sky ${screen.width} × ${screen.height} px. ` +
      `The player needs ${player.scanTime} s to spot a group, ${player.clickTime} s per click, ` +
      `looks at the highest ${player.attention} lanterns, and misses ${Math.round(player.ghostMiss * 100)}% of ghosts.`,
    `"Too crowded" is the first moment ${CROWDED} or more lanterns are in the sky at once.`,
  ];
  for (const theme of [...new Set(runs.map((r) => r.theme))]) {
    const themeRuns = runs.filter((r) => r.theme === theme);
    lines.push(
      '',
      `## ${theme === 'halloween' ? 'Halloween' : 'Classic'}`,
      '',
      '| Level | Target | Points | Result | Lives lost | Too crowded | Most in sky |',
      '|---|---|---|---|---|---|---|',
    );
    for (const r of themeRuns) {
      lines.push(
        `| ${r.level} | ${r.target} | ${r.score} | ${resultText(r)} | ${r.livesLost.length} | ` +
          `${r.crowdedAt === null ? 'never' : clock(r.crowdedAt)} | ${r.mostInSky} |`,
      );
    }
    for (const r of themeRuns.filter((run) => run.livesLost.length > 0)) {
      lines.push('', `Level ${r.level}, lives lost:`);
      for (const loss of r.livesLost) {
        lines.push(`- ${clock(loss.t)}: ${loss.cause} (${loss.inSky} lanterns in the sky)`);
      }
    }
  }
  return lines.join('\n') + '\n';
}

function parseArgs(argv) {
  const args = { seed: 1, levels: 6, theme: 'both', out: 'playtest-report.md' };
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, '');
    if (!(key in args)) throw new Error(`Unknown option --${key}`);
    args[key] = typeof args[key] === 'number' ? Number(argv[i + 1]) : argv[i + 1];
  }
  return args;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  const themes = args.theme === 'both' ? ['classic', 'halloween'] : [args.theme];
  const runs = playAll({ levels: args.levels, themes, seed: args.seed });
  const text = report(runs, { seed: args.seed });
  writeFileSync(args.out, text);
  process.stdout.write(text);
  console.error(`\nReport written to ${args.out}`);
}
