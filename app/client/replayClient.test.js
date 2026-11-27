const test = require('node:test');
const assert = require('node:assert');

process.env.BASE_URL = 'http://test.local/api';
const replayClient = require('./replayClient');

const capture = async (fn) => {
  const lines = { error: [], log: [] };
  const orig = { error: console.error, log: console.log };
  console.error = (...a) => lines.error.push(a);
  console.log = (...a) => lines.log.push(a);
  try { await fn(); } finally { Object.assign(console, orig); }
  return lines;
};

test('삭제 기한 409는 안내 문구를 그대로 전달하고 에러 로그를 남기지 않는다', async () => {
  global.fetch = async () => new Response(
    JSON.stringify({ status: 'error', message: '리플 삭제 기한이 지난 리플입니다.', data: null }),
    { status: 409 },
  );

  let caught;
  const lines = await capture(async () => {
    try { await replayClient.delete_game('RPY-1', 'R0', 'actor'); } catch (e) { caught = e; }
  });

  assert.equal(caught.message, '리플 삭제 기한이 지난 리플입니다.');
  assert.equal(caught.status, 409);
  assert.equal(caught.expected, true);
  assert.equal(lines.error.length, 0);
});

test('404는 여전히 에러 로그에 남긴다', async () => {
  global.fetch = async () => new Response(
    JSON.stringify({ status: 'error', message: 'Game not found or already deleted', data: null }),
    { status: 404 },
  );

  const lines = await capture(async () => {
    await assert.rejects(() => replayClient.delete_game('RPY-1', 'R0', 'actor'));
  });

  assert.equal(lines.error.length, 1);
});
