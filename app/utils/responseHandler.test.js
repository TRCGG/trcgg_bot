const test = require('node:test');
const assert = require('node:assert');
const { BotError } = require('./errors');

// responseHandler가 로드되기 전에 전송을 가로챈다.
const discordUtilsPath = require.resolve('./discordUtils');
const sent = [];
require.cache[discordUtilsPath] = {
  id: discordUtilsPath,
  filename: discordUtilsPath,
  loaded: true,
  exports: {
    safeReply: async (_msg, text) => { sent.push(text); return true; },
  },
};

const res = require('./responseHandler');

const capture = async (fn) => {
  const lines = [];
  const original = console.error;
  console.error = (...a) => lines.push(a);
  try { await fn(); } finally { console.error = original; }
  return lines;
};

// networkUtils가 이미 url·status·guild·본문을 남겼다. 여기서 또 남기면 한 실패에 두 블록이 된다.
test('5xx는 다시 로그를 남기지 않는다', async () => {
  sent.length = 0;
  const lines = await capture(() => res.error({}, new BotError('내부 오류', 500)));

  assert.equal(lines.length, 0);
  assert.deepEqual(sent, ['⚠️ 오류가 발생했습니다.']);
});

test('5xx는 safeReply의 결과를 그대로 반환한다', async () => {
  assert.equal(await res.error({}, new BotError('내부 오류', 503)), true);
});

// 백엔드 내부 메시지가 사용자에게 새면 안 된다(f80da25).
test('5xx는 백엔드 메시지를 감추고 4xx는 노출한다', async () => {
  sent.length = 0;
  await capture(async () => {
    await res.error({}, new BotError('DB 커넥션 풀 고갈', 500));
    await res.error({}, new BotError('이미 등록된 리플입니다', 400));
  });

  assert.deepEqual(sent, ['⚠️ 오류가 발생했습니다.', '⚠️ 이미 등록된 리플입니다']);
});

// status 0(타임아웃·연결 실패)은 5xx 숨김 분기를 타면 안 된다.
test('status 0은 메시지를 그대로 노출한다', async () => {
  sent.length = 0;
  await capture(() => res.error({}, new BotError('서버에 연결할 수 없습니다', 0)));
  assert.deepEqual(sent, ['⚠️ 서버에 연결할 수 없습니다']);
});

test('BotError가 아닌 오류도 메시지를 노출한다', async () => {
  sent.length = 0;
  await capture(() => res.error({}, new Error('닉네임은 두 글자 이상 입력해주세요')));
  assert.deepEqual(sent, ['⚠️ 닉네임은 두 글자 이상 입력해주세요']);
});

test('success와 noAuth는 정해진 문구를 보낸다', async () => {
  sent.length = 0;
  await res.success({}, '부캐 저장 완료');
  await res.noAuth({});
  assert.deepEqual(sent, ['✅ 부캐 저장 완료', '⛔ 권한이 없습니다.']);
});
