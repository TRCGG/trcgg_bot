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

const assertRunsAt = async ({ expression, options }, hit, miss) => {
  // 아래 시각 판정은 KST 머신에선 timezone이 없어도 통과한다.
  assert.strictEqual(options?.timezone, 'Asia/Seoul');
  const task = realCron.createTask(expression, () => {}, options);
  try {
    assert.strictEqual(task.match(new Date(hit)), true);
    assert.strictEqual(task.match(new Date(miss)), false);
  } finally {
    await task.destroy();
  }
};

test('스케줄은 서버 시간대와 무관하게 한국 시간 기준으로 나간다', async () => {
  await schedule.cronSchedule({ channels: { cache: new Map() } });

  assert.strictEqual(scheduled.length, 2);
  // 내전 공지 KST 17:00, 길드 목록 KST 09:00
  await assertRunsAt(scheduled[0], '2026-11-16T08:00:00Z', '2026-11-16T17:00:00Z');
  await assertRunsAt(scheduled[1], '2026-11-16T00:00:00Z', '2026-11-16T09:00:00Z');
});
