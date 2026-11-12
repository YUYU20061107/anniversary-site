// 运行：node --test tests/logic.test.js tests/board.test.js
const test = require('node:test');
const assert = require('node:assert');
const L = require('../js/logic.js');
const G = require('../js/game-core.js');

test('daysTogether counts 365 days on the first anniversary', () => {
  assert.strictEqual(L.daysTogether('2025-11-12', new Date(2026, 10, 12, 15, 30)), 365);
});

test('daysTogether is 0 on the start day and never negative', () => {
  assert.strictEqual(L.daysTogether('2025-11-12', new Date(2025, 10, 12, 23, 59)), 0);
  assert.strictEqual(L.daysTogether('2025-11-12', new Date(2025, 0, 1)), 0);
});

test('parseDate rejects a malformed date', () => {
  assert.throws(() => L.parseDate('2025/11/12'), /日期格式/);
});

test('shuffled keeps every item and does not change the input', () => {
  const input = [1, 2, 3, 4, 5, 6];
  const out = L.shuffled(input, L.seededRandom(7));
  assert.deepStrictEqual(input, [1, 2, 3, 4, 5, 6]);
  assert.deepStrictEqual(out.slice().sort(), input);
});

const DISHES = [
  { name: '香菜', icon: 'a', love: false },
  { name: '火锅', icon: 'b', love: true },
  { name: '苦瓜', icon: 'c', love: false },
];

test('picking a disliked dish removes it without mutating the old table', () => {
  const table = L.createTable(DISHES);
  const { table: next, outcome } = L.pickDish(table, 0);
  assert.strictEqual(outcome, 'removed');
  assert.strictEqual(next[0].removed, true);
  assert.strictEqual(table[0].removed, false);
  assert.strictEqual(L.dishesLeftToRemove(next), 1);
});

test('picking a favourite dish keeps it on the table', () => {
  const table = L.createTable(DISHES);
  const { table: next, outcome } = L.pickDish(table, 1);
  assert.strictEqual(outcome, 'kept');
  assert.strictEqual(next, table);
});

test('table is done only when every disliked dish is gone', () => {
  let table = L.createTable(DISHES);
  assert.strictEqual(L.isTableDone(table), false);
  table = L.pickDish(table, 0).table;
  table = L.pickDish(table, 2).table;
  assert.strictEqual(L.isTableDone(table), true);
  assert.strictEqual(L.pickDish(table, 0).outcome, 'gone');
});

test('createTable throws on an empty menu and pickDish on an unknown id', () => {
  assert.throws(() => L.createTable([]), /不能为空/);
  assert.throws(() => L.pickDish(L.createTable(DISHES), 99), /没有这道菜/);
});

function runBot(game, frames) {
  const bot = G.createBot();
  const seen = new Set();
  for (let i = 0; i < frames && game.phase !== 'won'; i++) {
    G.step(game, bot(game));
    game.events.forEach((e) => seen.add(e));
  }
  return seen;
}

test('a solo player can never get past the wall', () => {
  const game = G.createGame({ allowJoin: false });
  runBot(game, 60 * 90);
  assert.strictEqual(game.phase, 'solo');
  assert.ok(game.p1.x < G.WALL_COL * G.TILE, 'p1 stopped before the wall, x=' + game.p1.x);
  assert.ok(game.p1.x > (G.WALL_COL - 3) * G.TILE, 'p1 actually reached the wall, x=' + game.p1.x);
});

test('P2 joins at the join point and the level is beatable together', () => {
  const game = G.createGame();
  const seen = runBot(game, 60 * 180);
  assert.ok(seen.has('join'), 'join event fired');
  assert.ok(seen.has('duo'), 'duo event fired');
  assert.ok(seen.has('boost'), 'double jump was used');
  assert.strictEqual(game.phase, 'won');
  assert.ok(game.p2, 'p2 exists');
  assert.ok(game.collected > 0, 'collected some hearts');
});

test('standing still never triggers anything and the hero rests on the ground', () => {
  const game = G.createGame();
  for (let i = 0; i < 300; i++) G.step(game, {});
  assert.strictEqual(game.phase, 'solo');
  assert.strictEqual(game.p1.y, G.GROUND_Y - G.HERO.h);
  assert.strictEqual(game.p1.onGround, true);
});

test('falling into a pit respawns the hero on safe ground', () => {
  const game = G.createGame();
  let hurt = false;
  for (let i = 0; i < 600 && !hurt; i++) {
    G.step(game, { right: true });
    hurt = game.events.includes('hurt');
    if (game.enemies[0]) game.enemies.forEach((e) => { e.alive = false; });
  }
  assert.ok(hurt, 'hero fell into the first pit');
  assert.ok(game.p1.x < 18 * G.TILE, 'respawned before the pit');
  assert.strictEqual(game.p1.y, G.GROUND_Y - G.HERO.h);
});
