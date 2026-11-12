// 运行：node --test tests/logic.test.js tests/board.test.js
const test = require('node:test');
const assert = require('node:assert');
const B = require('../js/board-core.js');

const EVENTS = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id }));
const REWARDS = ['r1', 'r2', 'r3'];

test('ringPath is a closed loop of 20 unique neighbouring cells starting at the front corner', () => {
  const path = B.ringPath(6);
  assert.strictEqual(path.length, 20);
  assert.deepStrictEqual(path[0], { col: 5, row: 5 });
  assert.strictEqual(new Set(path.map((c) => c.col + ',' + c.row)).size, 20);
  path.forEach((cell, i) => {
    const next = path[(i + 1) % path.length];
    assert.strictEqual(Math.abs(cell.col - next.col) + Math.abs(cell.row - next.row), 1);
  });
});

test('buildTiles puts the events in order every 3 tiles with rewards in between', () => {
  const tiles = B.buildTiles(EVENTS, REWARDS);
  assert.strictEqual(tiles[0].type, 'start');
  assert.deepStrictEqual(tiles.filter((t) => t.type === 'event').map((t) => t.index), [3, 6, 9, 12, 15, 18]);
  assert.deepStrictEqual(tiles.filter((t) => t.type === 'event').map((t) => t.event.id), ['a', 'b', 'c', 'd', 'e', 'f']);
  assert.deepStrictEqual(tiles.filter((t) => t.type === 'reward').map((t) => t.index), [1, 4, 7, 10, 13, 16, 19]);
  assert.strictEqual(tiles[10].reward, 'r1'); // 奖励不够时循环使用
});

test('buildTiles rejects an empty or over-long journey', () => {
  assert.throws(() => B.buildTiles([], REWARDS), /不能为空/);
  assert.throws(() => B.buildTiles(EVENTS.concat([{ id: 'g' }]), REWARDS), /最多放 6 件/);
});

test('a big roll is capped so an event is never skipped, and the old state is untouched', () => {
  const tiles = B.buildTiles(EVENTS, REWARDS);
  const start = B.createJourney();
  const result = B.move(tiles, start, 6);
  assert.strictEqual(result.steps, 3);
  assert.strictEqual(result.capped, true);
  assert.deepStrictEqual(result.path, [1, 2, 3]);
  assert.deepStrictEqual(result.collected, ['r1']);
  assert.strictEqual(result.event.id, 'a');
  assert.deepStrictEqual(start, { pos: 0, bag: [], seen: 0, finished: false });
});

test('a small roll moves exactly that far and triggers nothing on a plain tile', () => {
  const tiles = B.buildTiles(EVENTS, REWARDS);
  const result = B.move(tiles, B.createJourney(), 2);
  assert.strictEqual(result.state.pos, 2);
  assert.strictEqual(result.capped, false);
  assert.strictEqual(result.event, null);
  assert.strictEqual(result.finished, false);
});

test('whatever the dice say, one lap shows all events in order, collects every reward and ends at the start', () => {
  [() => 0, () => 0.999, () => 0.5].concat([Math.random]).forEach((random) => {
    const tiles = B.buildTiles(EVENTS, REWARDS);
    let state = B.createJourney();
    const seen = [];
    for (let i = 0; i < 100 && !state.finished; i++) {
      const result = B.move(tiles, state, B.rollDice(random));
      if (result.event) seen.push(result.event.id);
      state = result.state;
    }
    assert.deepStrictEqual(seen, ['a', 'b', 'c', 'd', 'e', 'f']);
    assert.strictEqual(state.finished, true);
    assert.strictEqual(state.pos, 0);
    assert.strictEqual(state.bag.length, 7);
  });
});

test('a finished journey ignores further rolls and a bad roll throws', () => {
  const tiles = B.buildTiles(EVENTS, REWARDS);
  const done = { pos: 0, bag: [], seen: 6, finished: true };
  assert.strictEqual(B.move(tiles, done, 4).state, done);
  assert.throws(() => B.move(tiles, B.createJourney(), 0), /骰子点数/);
  assert.throws(() => B.move(tiles, B.createJourney(), 7), /骰子点数/);
});

test('rollDice stays within 1..6', () => {
  assert.strictEqual(B.rollDice(() => 0), 1);
  assert.strictEqual(B.rollDice(() => 0.9999), 6);
});
