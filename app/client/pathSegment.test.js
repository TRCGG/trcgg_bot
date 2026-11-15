const test = require('node:test');
const assert = require('node:assert');

process.env.BASE_URL = 'http://test.local/api';

const replayClient = require('./replayClient');
const recordClient = require('./recordClient');

const captureFetch = () => {
  const requested = [];
  global.fetch = async (url, config) => {
    requested.push({ method: config.method, path: new URL(url).pathname });
    return new Response(JSON.stringify({ data: {} }), { status: 200 });
  };
  return requested;
};

test('게임 ID로 상위 경로를 지정해도 games 아래 한 칸으로만 요청한다', async () => {
  for (const gameId of ['../../../guilds/123', '%2e%2e/%2e%2e/%2e%2e/guilds/123', 'a/../../x']) {
    const requested = captureFetch();
    await replayClient.delete_game(gameId, 'R0', 'actor');
    await recordClient.get_result_record(gameId, 'R0');
    for (const { path } of requested) {
      assert.ok(path.startsWith('/api/matches/R0/games/'), path);
      assert.strictEqual(path.split('/').length, 6, path);
    }
  }
});

test('점 하나·둘로만 된 ID는 요청하지 않고 거절한다', async () => {
  for (const gameId of ['.', '..', '']) {
    const requested = captureFetch();
    await assert.rejects(() => replayClient.delete_game(gameId, 'R0', 'actor'), /사용할 수 없는 입력/);
    await assert.rejects(() => recordClient.get_result_record(gameId, 'R0'), /사용할 수 없는 입력/);
    await assert.rejects(() => recordClient.get_all_record(gameId, null, 'R0'), /사용할 수 없는 입력/);
    assert.deepStrictEqual(requested, []);
  }
});

test('정상 게임 ID는 디코딩하면 원래 값 그대로 전달된다', async () => {
  const requested = captureFetch();
  const gameId = 'RPY-260711-내전 1경기#2-42';
  await recordClient.get_result_record(gameId, 'R0');
  const lastSegment = requested[0].path.split('/').pop();
  assert.strictEqual(decodeURIComponent(lastSegment), gameId);
});
