const test = require('node:test');
const assert = require('node:assert');

// schedule이 로드되기 전에 node-cron을 가로챈다.
const cronPath = require.resolve('node-cron');
const scheduled = [];
require.cache[cronPath] = {
  id: cronPath,
  filename: cronPath,
  loaded: true,
  exports: { schedule: (expression, task, options) => scheduled.push({ expression, options }) },
};

const schedule = require('./schedule');
const TimeMatcher = require('node-cron/src/time-matcher');

test('내전 공지는 서버 시간대와 무관하게 한국 시간 17시에 나간다', async () => {
  await schedule.cronSchedule({ channels: { cache: new Map() } });

  assert.strictEqual(scheduled.length, 1);
  const { expression, options } = scheduled[0];
  const matcher = new TimeMatcher(expression, options?.timezone);
  assert.strictEqual(matcher.match(new Date('2026-11-16T08:00:00Z')), true); // KST 17:00
  assert.strictEqual(matcher.match(new Date('2026-11-16T17:00:00Z')), false); // KST 02:00
});
