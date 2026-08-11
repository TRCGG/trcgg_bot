const test = require('node:test');
const assert = require('node:assert');

process.env.BASE_URL = 'http://test.local/api';

// recordService가 로드되기 전에 실제 fetch를 가로챈다.
// networkUtils를 통째로 stub하지 않는 이유: expectedStatuses가 실제로 먹히는지까지 봐야 한다.
const recordService = require('./recordService');

const NOT_FOUND_BODY = JSON.stringify({
  status: 'error',
  message: 'guild member not found',
  data: null,
});

const makeMsg = () => ({ guild: { id: '922118764437340230' } });

const capture = async (fn) => {
  const lines = { error: [], warn: [], log: [] };
  const orig = { error: console.error, warn: console.warn, log: console.log };
  console.error = (...a) => lines.error.push(a);
  console.warn = (...a) => lines.warn.push(a);
  console.log = (...a) => lines.log.push(a);
  try { await fn(); } finally { Object.assign(console, orig); }
  return lines;
};

// 엔드포인트별로 다른 응답을 주기 위한 스텁.
const routeFetch = (byPath) => {
  global.fetch = async (url) => {
    const key = String(url).includes('/dashboard') ? 'dashboard' : 'games';
    const { body, status } = byPath[key];
    return new Response(body, { status });
  };
};

// 검색 실패 1회가 로그 2건을 만들던 문제(/dashboard·/games가 각자 404).
test('멤버 미존재 검색은 에러 로그를 남기지 않고 안내 메시지 하나만 낸다', async () => {
  const requested = [];
  global.fetch = async (url) => {
    requested.push(String(url));
    return new Response(NOT_FOUND_BODY, { status: 404 });
  };

  let caught;
  const lines = await capture(async () => {
    try { await recordService.get_all_record_embed(makeMsg(), ['없는닉']); }
    catch (e) { caught = e; }
  });

  assert.match(caught.message, /검색 결과가 없습니다/);
  assert.equal(lines.error.length, 0, '에러 로그가 남았다');
  assert.equal(requested.length, 2);
});

// 개수만 세면 순차로 바꿔도 통과한다. 첫 응답을 두 번째 요청이 올 때까지 붙잡아
// 실제로 동시에 나가는지 본다. 순차면 첫 응답이 영영 안 풀려 시간초과로 잡힌다.
test('두 조회는 동시에 나간다', async () => {
  let releaseFirst;
  const secondArrived = new Promise((resolve) => { releaseFirst = resolve; });
  let count = 0;

  global.fetch = async () => {
    count += 1;
    if (count === 1) await secondArrived;
    else releaseFirst();
    return new Response(NOT_FOUND_BODY, { status: 404 });
  };

  const call = capture(async () => {
    try { await recordService.get_all_record_embed(makeMsg(), ['없는닉']); } catch { /* 안내 메시지 */ }
  });

  const timedOut = Symbol('timeout');
  const timer = new Promise((resolve) => setTimeout(() => resolve(timedOut), 1000));
  const outcome = await Promise.race([call, timer]);

  releaseFirst(); // 실패했더라도 매달린 요청을 풀어준다
  assert.notEqual(outcome, timedOut, '순차 실행됐다 — 병렬성이 깨졌다');
});

// status만으로 판단하면 라우트 오타 같은 다른 404까지 삼킨다.
test('guild member not found가 아닌 404는 삼키지 않는다', async () => {
  global.fetch = async () =>
    new Response(JSON.stringify({ status: 'error', message: 'Cannot GET /matches' }), { status: 404 });

  let caught;
  await capture(async () => {
    try { await recordService.get_all_record_embed(makeMsg(), ['없는닉']); }
    catch (e) { caught = e; }
  });

  assert.doesNotMatch(caught.message, /검색 결과가 없습니다/);
  assert.equal(caught.status, 404);
});

test('5xx는 그대로 전파된다', async () => {
  global.fetch = async () =>
    new Response(JSON.stringify({ detail: '오류가 발생했습니다.' }), { status: 500 });

  let caught;
  await capture(async () => {
    try { await recordService.get_all_record_embed(makeMsg(), ['아무개']); }
    catch (e) { caught = e; }
  });

  assert.equal(caught.status, 500);
});

// Promise.all은 먼저 도착한 rejection을 던져 어느 쪽이 보일지 경합에 맡긴다.
// 한쪽이 진짜 장애인데 다른 쪽 404에 가려 "검색 결과 없음"이 되면 장애를 놓친다.
// 두 방향 모두 500이 이겨야 한다 — 한 방향만 보면 배열 순서에 기댄 통과가 된다.
test('한쪽이 5xx면 다른 쪽 404보다 우선해 전파된다', async () => {
  for (const broken of ['dashboard', 'games']) {
    const other = broken === 'dashboard' ? 'games' : 'dashboard';
    routeFetch({
      [broken]: { body: JSON.stringify({ detail: 'DB 장애' }), status: 500 },
      [other]: { body: NOT_FOUND_BODY, status: 404 },
    });

    let caught;
    await capture(async () => {
      try { await recordService.get_all_record_embed(makeMsg(), ['없는닉']); }
      catch (e) { caught = e; }
    });

    assert.equal(caught.status, 500, `${broken}이 500일 때 5xx가 가려졌다`);
    assert.doesNotMatch(caught.message, /검색 결과가 없습니다/);
  }
});
