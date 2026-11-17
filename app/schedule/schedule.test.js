const test = require('node:test');
const assert = require('node:assert');

// 실제 모듈을 먼저 받아두고, schedule이 로드되기 전에 캐시를 스텁으로 바꾼다.
const realCron = require('node-cron');
const cronPath = require.resolve('node-cron');
const scheduled = [];
require.cache[cronPath] = {
  id: cronPath,
  filename: cronPath,
  loaded: true,
  exports: { schedule: (expression, task, options) => scheduled.push({ expression, options }) },
};

const schedule = require('./schedule');

test('내전 공지는 서버 시간대와 무관하게 한국 시간 17시에 나간다', async () => {
  await schedule.cronSchedule({ channels: { cache: new Map() } });

  assert.strictEqual(scheduled.length, 1);
  const { expression, options } = scheduled[0];
  // 아래 시각 판정은 KST 머신에선 timezone이 없어도 통과한다.
  assert.strictEqual(options?.timezone, 'Asia/Seoul');
  const task = realCron.createTask(expression, () => {}, options);
  try {
    assert.strictEqual(task.match(new Date('2026-11-16T08:00:00Z')), true); // KST 17:00
    assert.strictEqual(task.match(new Date('2026-11-16T17:00:00Z')), false); // KST 02:00
  } finally {
    await task.destroy();
  }
});
