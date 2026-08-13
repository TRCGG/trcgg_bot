const test = require('node:test');
const assert = require('node:assert');

process.env.BASE_URL = 'http://test.local/api';
const httpClient = require('./networkUtils');

const stubFetch = (body, init = {}) => {
  global.fetch = async () => new Response(body, init);
};

const capture = async (fn) => {
  const lines = { error: [], warn: [], log: [] };
  const orig = { error: console.error, warn: console.warn, log: console.log };
  console.error = (...a) => lines.error.push(a);
  console.warn = (...a) => lines.warn.push(a);
  console.log = (...a) => lines.log.push(a);
  try { await fn(); } finally { Object.assign(console, orig); }
  return lines;
};

// recordService가 이 문자열 완전일치로 404를 분기한다(2792cb5).
// 메시지 조립을 건드리면 그 분기가 조용히 깨지므로 여기서 고정한다.
test('expected 404는 메시지를 그대로 보존하고 에러 로그를 남기지 않는다', async () => {
  stubFetch(JSON.stringify({ status: 'error', message: 'guild member not found', data: null }),
    { status: 404 });

  let caught;
  const lines = await capture(async () => {
    try {
      await httpClient.get('/matches/g/닉/dashboard', {}, { expectedStatuses: [404] });
    } catch (e) { caught = e; }
  });

  assert.equal(caught.message, 'guild member not found');
  assert.equal(caught.status, 404);
  assert.equal(caught.expected, true);
  assert.equal(lines.error.length, 0);
  assert.equal(lines.warn.length, 0);
  // stderr로 나가면 pm2 error.log에 그대로 쌓여 노이즈 제거가 무의미해진다.
  assert.equal(lines.log.length, 1);
});

test('정상 분기 로그에도 길드가 실린다', async () => {
  stubFetch(JSON.stringify({ message: 'guild member not found' }), { status: 404 });

  const lines = await capture(async () => {
    await assert.rejects(() => httpClient.get('/x', {}, {
      expectedStatuses: [404], guildId: '922118764437340230',
    }));
  });

  assert.match(lines.log[0][0], /guild=922118764437340230/);
});

// detail이 message보다 우선이라는 순서 자체를 고정한다.
// 두 키가 함께 오는 응답이 없으면 순서를 뒤집어도 아무 테스트가 안 깨진다.
test('detail이 message보다 우선한다', async () => {
  stubFetch(JSON.stringify({ detail: 'detail 쪽', message: 'message 쪽' }), { status: 400 });

  let caught;
  await capture(async () => {
    try { await httpClient.get('/replays'); } catch (e) { caught = e; }
  });

  assert.equal(caught.message, 'detail 쪽');
});

// 문자열 한 줄만 남기면 어느 API가 몇 초 만에 끊겼는지 알 수 없다.
test('응답 단계 타임아웃은 API·길드와 함께 기록된다', async () => {
  global.fetch = async () => { throw Object.assign(new Error('aborted'), { name: 'TimeoutError' }); };

  let caught;
  const lines = await capture(async () => {
    try { await httpClient.get('/replays', {}, { guildId: '922118764437340230' }); }
    catch (e) { caught = e; }
  });

  assert.equal(caught.message, '요청 시간 초과');
  // status 0이라 responseHandler의 5xx 숨김 분기를 타지 않는다 — 이 문구가 사용자에게 간다.
  assert.equal(caught.status, 0);
  assert.equal(caught.type, 'request-timeout');

  const [label, detail] = lines.error[0];
  assert.match(label, /Timeout/);
  assert.equal(detail.stage, 'response');
  assert.equal(detail.method, 'GET');
  assert.match(detail.url, /\/replays$/);
  assert.equal(detail.guild, '922118764437340230');
  assert.equal(detail.timeoutMs, 45000);
});

// 헤더만 받고 본문 스트리밍 중 끊기는 경우. 원인이 달라서 stage로 구분해야 한다.
test('본문 단계 타임아웃은 stage로 구분해 기록된다', async () => {
  global.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => { throw Object.assign(new Error('aborted'), { name: 'TimeoutError' }); },
  });

  let caught;
  const lines = await capture(async () => {
    try { await httpClient.get('/replays'); } catch (e) { caught = e; }
  });

  assert.equal(caught.message, '요청 시간 초과');
  assert.equal(lines.error[0][1].stage, 'body');
  assert.equal(lines.error[0][1].status, 200);
});

// 억제가 과하게 번지지 않았는지 — 선언하지 않은 코드는 그대로 에러여야 한다.
test('선언하지 않은 상태코드는 계속 에러 로그를 남긴다', async () => {
  stubFetch(JSON.stringify({ detail: '서버 오류' }), { status: 500 });

  const lines = await capture(async () => {
    await assert.rejects(() => httpClient.get('/matches/g/닉/dashboard', {}, { expectedStatuses: [404] }),
      (e) => e.status === 500 && e.expected === false);
  });

  assert.equal(lines.error.length, 1);
  assert.equal(lines.warn.length, 0);
});

// 기본값이 비어 있어야 한다. 전역 기본값을 주면 선언하지 않은 호출부까지 조용해진다.
test('아무것도 선언하지 않으면 400·404도 에러 로그를 남긴다', async () => {
  for (const status of [400, 404]) {
    stubFetch(JSON.stringify({ message: '정상 아님' }), { status });

    const lines = await capture(async () => {
      await assert.rejects(() => httpClient.get('/matches/g/닉/dashboard'),
        (e) => e.status === status && e.expected === false);
    });

    assert.equal(lines.error.length, 1, `${status}가 기본값으로 억제됐다`);
    assert.equal(lines.log.length, 0);
  }
});

// 길드 id는 base64로 오는 경로와 원본으로 오는 경로가 섞여 있다.
// 로그에서 갈리면 길드별 집계가 안 되므로 한 값으로 맞춰야 한다.
test('길드 id를 원본 형태로 통일해 로그에 남긴다', async () => {
  const RAW = '922118764437340230';
  const ENCODED = Buffer.from(RAW, 'utf8').toString('base64');

  for (const passed of [RAW, ENCODED]) {
    stubFetch(JSON.stringify({ detail: '서버 오류' }), { status: 500 });

    let caught;
    const lines = await capture(async () => {
      try { await httpClient.get('/matches/x/닉/dashboard', {}, { guildId: passed }); }
      catch (e) { caught = e; }
    });

    assert.equal(lines.error[0][1].guild, RAW, `${passed} 가 원본으로 안 바뀌었다`);
    assert.equal(caught.guildId, RAW);
  }
});

test('guildId·expectedStatuses는 모든 verb에서 fetch 옵션으로 새지 않는다', async () => {
  let seenConfig;
  global.fetch = async (_url, config) => {
    seenConfig = config;
    return new Response(JSON.stringify({ data: {} }), { status: 200 });
  };
  const opts = { guildId: '922118764437340230', expectedStatuses: [404] };

  await httpClient.get('/x', {}, opts);
  assert.deepEqual(Object.keys(seenConfig).sort(), ['headers', 'method', 'signal']);

  for (const verb of ['post', 'put', 'delete']) {
    await httpClient[verb]('/x', { a: 1 }, opts);
    assert.equal(seenConfig.guildId, undefined, `${verb}에서 guildId가 샜다`);
    assert.equal(seenConfig.expectedStatuses, undefined, `${verb}에서 expectedStatuses가 샜다`);
    assert.equal(seenConfig.body, '{"a":1}');
  }
});

// 본문을 못 읽은 걸 204로 오해하면 호출부가 undefined를 정상값으로 받는다.
test('성공 응답의 본문 읽기 실패는 삼키지 않는다', async () => {
  const readError = new Error('socket hang up');
  global.fetch = async () => ({ ok: true, status: 200, text: async () => { throw readError; } });

  await assert.rejects(() => httpClient.get('/x'), (e) => e === readError);
});

test('실패 응답은 본문을 못 읽어도 상태코드를 살린다', async () => {
  global.fetch = async () => ({
    ok: false, status: 503, text: async () => { throw new Error('socket hang up'); },
  });

  let caught;
  await capture(async () => {
    try { await httpClient.get('/x'); } catch (e) { caught = e; }
  });
  assert.equal(caught.status, 503);
});

// 프록시가 200에 로그인 페이지를 주는 경우. 안 남기면 어디에도 기록이 없다.
test('해석 불가한 성공 응답도 길드와 함께 에러 로그를 남긴다', async () => {
  stubFetch('<html>login</html>', { status: 200 });

  let caught;
  const lines = await capture(async () => {
    try { await httpClient.get('/x', {}, { guildId: '922118764437340230' }); }
    catch (e) { caught = e; }
  });

  assert.equal(lines.error.length, 1);
  assert.equal(lines.error[0][1].guild, '922118764437340230');
  assert.equal(caught.guildId, '922118764437340230');
});

test('expectedStatuses는 fetch 옵션으로 새어나가지 않는다', async () => {
  let seenConfig;
  global.fetch = async (_url, config) => {
    seenConfig = config;
    return new Response(JSON.stringify({ data: {} }), { status: 200 });
  };

  await httpClient.get('/matches/g/닉/dashboard', {}, { expectedStatuses: [404] });
  assert.equal(seenConfig.expectedStatuses, undefined);
  assert.equal(seenConfig.method, 'GET');
});

test('중복 리플 등록(400)은 에러 로그를 남기지 않는다', async () => {
  stubFetch(JSON.stringify({ type: 'business-error', status: 400, detail: 'duplicated replay data' }),
    { status: 400 });

  const lines = await capture(async () => {
    await assert.rejects(() => httpClient.post('/replays', {}, { expectedStatuses: [400] }),
      (e) => e.status === 400 && e.expected === true);
  });

  assert.equal(lines.error.length, 0);
});

// 프록시 HTML·빈 본문이 오면 예전엔 'Unknown error'로 뭉개져 추적이 불가능했다.
test('비JSON 5xx 본문을 뭉개지 않고 상태코드와 원문을 남긴다', async () => {
  stubFetch('<html><body>502 Bad Gateway</body></html>', { status: 502 });

  let caught;
  await capture(async () => {
    try { await httpClient.get('/replays'); } catch (e) { caught = e; }
  });

  assert.equal(caught.status, 502);
  assert.equal(caught.message, 'HTTP 502');
  assert.match(caught.bodySnippet, /502 Bad Gateway/);
});

test('본문 스니펫은 300자로 자른다', async () => {
  stubFetch('x'.repeat(5000), { status: 502 });

  let caught;
  await capture(async () => {
    try { await httpClient.get('/replays'); } catch (e) { caught = e; }
  });

  assert.equal(caught.bodySnippet.length, 300);
});

// 본문 없는 실패와 있는 실패를 구분해야 프록시 문제와 백엔드 문제가 갈린다.
test('빈 본문 실패는 빈 응답임을 메시지에 남긴다', async () => {
  stubFetch('', { status: 504 });

  let caught;
  await capture(async () => {
    try { await httpClient.get('/replays'); } catch (e) { caught = e; }
  });

  assert.equal(caught.status, 504);
  assert.equal(caught.message, 'HTTP 504 (빈 응답)');
});

test('정상 응답은 data를 반환한다', async () => {
  stubFetch(JSON.stringify({ status: 'success', data: { hello: 'world' } }), { status: 200 });
  assert.deepEqual(await httpClient.get('/matches/g/닉/dashboard'), { hello: 'world' });
});

// 204 No Content를 파싱 실패로 취급하면 삭제 계열 호출이 깨진다.
// Response 생성자가 204에 본문을 허용하지 않아 null로 만든다.
test('본문 없는 성공 응답은 undefined를 반환한다', async () => {
  global.fetch = async () => new Response(null, { status: 204 });
  assert.equal(await httpClient.delete('/matches/g/games/RPY-1', {}), undefined);
});

test('본문이 있는데 JSON이 아닌 성공 응답은 드러낸다', async () => {
  stubFetch('<html>login page</html>', { status: 200 });

  let caught;
  await capture(async () => {
    try { await httpClient.get('/matches/g/닉/dashboard'); } catch (e) { caught = e; }
  });

  assert.equal(caught.message, '응답을 해석하지 못했습니다');
  assert.match(caught.bodySnippet, /login page/);
});

// TRC-261 계약: 원인은 ProblemDetails.type으로 온다.
// errorHandler에서 detail만 showMessage 게이트를 타고 type은 항상 나오므로,
// 5xx로 메시지가 숨겨져도 type으로 원인을 알 수 있다.
test('백엔드 ProblemDetails.type을 BotError로 받는다', async () => {
  stubFetch(JSON.stringify({
    type: 'discord-download-timeout',
    title: 'Gateway Timeout',
    status: 504,
    detail: '오류가 발생했습니다.',
  }), { status: 504 });

  let caught;
  await capture(async () => {
    try { await httpClient.post('/replays', {}); } catch (e) { caught = e; }
  });

  assert.equal(caught.status, 504);
  assert.equal(caught.type, 'discord-download-timeout');
});

// 백엔드 자체 문제와 백엔드가 Discord를 기다린 건 조치가 다르다.
test('Discord 상류 실패는 target을 backend-discord로 남긴다', async () => {
  for (const type of ['discord-download-timeout', 'discord-download-failed']) {
    stubFetch(JSON.stringify({ type, status: 504, detail: '오류' }), { status: 504 });

    const lines = await capture(async () => {
      await assert.rejects(() => httpClient.post('/replays', {}, { guildId: '922118764437340230' }));
    });

    assert.equal(lines.error[0][1].target, 'backend-discord', `${type}이 backend로 분류됐다`);
    assert.equal(lines.error[0][1].type, type);
  }
});

test('그 외 백엔드 실패는 target이 backend다', async () => {
  stubFetch(JSON.stringify({ type: 'system-error', status: 500, detail: '오류' }), { status: 500 });

  const lines = await capture(async () => {
    await assert.rejects(() => httpClient.get('/x'));
  });

  assert.equal(lines.error[0][1].target, 'backend');
});

// 백엔드 미기동 시 예전엔 로그가 0건이고 사용자에게 'fetch failed'가 노출됐다.
test('연결 실패는 원인과 함께 기록되고 한국어 메시지가 된다', async () => {
  global.fetch = async () => {
    throw Object.assign(new TypeError('fetch failed'), {
      cause: Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }),
    });
  };

  let caught;
  const lines = await capture(async () => {
    try { await httpClient.get('/x', {}, { guildId: '922118764437340230' }); }
    catch (e) { caught = e; }
  });

  assert.equal(lines.error.length, 1);
  const detail = lines.error[0][1];
  assert.equal(detail.target, 'backend');
  assert.equal(detail.reason, 'unreachable');
  assert.equal(detail.cause, 'ECONNREFUSED');
  assert.equal(detail.guild, '922118764437340230');

  assert.equal(caught.message, '서버에 연결할 수 없습니다');
  assert.equal(caught.status, 0); // 5xx 숨김 분기를 타지 않아 이 문구가 사용자에게 간다
  assert.equal(caught.type, 'connection-failed'); // 타임아웃과 구분돼야 안내가 갈린다
});

test('타임아웃 로그는 target이 backend다', async () => {
  global.fetch = async () => { throw Object.assign(new Error('a'), { name: 'TimeoutError' }); };

  const lines = await capture(async () => {
    await assert.rejects(() => httpClient.get('/x'));
  });

  assert.equal(lines.error[0][1].target, 'backend');
  assert.equal(lines.error[0][1].stage, 'response');
});
