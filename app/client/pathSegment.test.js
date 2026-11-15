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

const TRAVERSALS = [
  '../../../guilds/123',
  '%2e%2e/%2e%2e/%2e%2e/guilds/123',
  '%2E%2E/%2E%2E/guilds/123',
  '..\\..\\..\\guilds\\123',
  'a/../../x',
];

const segments = (path) => path.split('/').filter(Boolean);

test('게임 ID로 상위 경로를 지정해도 games 아래 한 칸으로만 요청한다', async () => {
  for (const gameId of TRAVERSALS) {
    const requested = captureFetch();
    await replayClient.delete_game(gameId, 'R0', 'actor');
    await recordClient.get_result_record(gameId, 'R0');
    assert.strictEqual(requested.length, 2, gameId);
    for (const { path } of requested) {
      const parts = segments(path);
      assert.deepStrictEqual(parts.slice(0, 4), ['api', 'matches', 'R0', 'games'], path);
      assert.strictEqual(parts.length, 5, path);
    }
  }
});

test('닉네임으로 상위 경로를 지정해도 dashboard·games 앞 한 칸으로만 요청한다', async () => {
  for (const riotName of TRAVERSALS) {
    const requested = captureFetch();
    await recordClient.get_all_record(riotName, null, 'R0');
    await recordClient.get_recent_record(riotName, null, 'R0');
    assert.strictEqual(requested.length, 2, riotName);
    assert.deepStrictEqual(
      requested.map(({ path }) => {
        const parts = segments(path);
        return [parts.length, parts[2], parts[4]];
      }),
      [[5, 'R0', 'dashboard'], [5, 'R0', 'games']],
      riotName,
    );
  }
});

test('점 하나·둘·빈 값·깨진 문자열은 요청하지 않고 거절한다', async () => {
  for (const value of ['.', '..', '', 'a\uD800b']) {
    const requested = captureFetch();
    await assert.rejects(() => replayClient.delete_game(value, 'R0', 'actor'), /사용할 수 없는 입력/);
    await assert.rejects(() => recordClient.get_result_record(value, 'R0'), /사용할 수 없는 입력/);
    await assert.rejects(() => recordClient.get_all_record(value, null, 'R0'), /사용할 수 없는 입력/);
    await assert.rejects(() => recordClient.get_recent_record(value, null, 'R0'), /사용할 수 없는 입력/);
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
