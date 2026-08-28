const test = require('node:test');
const assert = require('node:assert');
const { PermissionsBitField } = require('discord.js');

// onMessage가 로드되기 전에 백엔드 호출을 가로챈다.
const replayServicePath = require.resolve('../services/replayService');
const saveCalls = [];
require.cache[replayServicePath] = {
  id: replayServicePath,
  filename: replayServicePath,
  loaded: true,
  exports: {
    save: async (...args) => {
      saveCalls.push(args);
      return { replayCode: 'RPY-20260812-test-001' };
    },
  },
};

const onMessage = require('./onMessage');

const makeUpload = (perms, content = '') => {
  const calls = { reply: 0, send: 0 };
  return {
    calls,
    msg: {
      inGuild: () => true,
      content,
      author: { bot: false, username: 'tester' },
      member: { nickname: '테스터' },
      guild: { id: 'G_TEST', name: '테스트길드' },
      attachments: new Map([['a1', { name: 'match.rofl', url: 'https://cdn.example/match.rofl' }]]),
      channel: {
        id: 'CH1',
        isTextBased: () => true,
        isThread: () => false,
        guild: { members: { me: {} } },
        permissionsFor: () => new PermissionsBitField(perms),
        send: async () => { calls.send++; },
      },
      reply: async () => { calls.reply++; },
    },
  };
};

const silenced = async (fn) => {
  const warn = console.warn;
  console.warn = () => {};
  try { await fn(); } finally { console.warn = warn; }
};

// 권한 확인은 응답에만 걸어야 한다. 백엔드 등록까지 막으면 리플이 유실된다.
test('전송 권한이 없어도 리플 저장 API는 호출된다', async () => {
  saveCalls.length = 0;
  const { msg, calls } = makeUpload([PermissionsBitField.Flags.ViewChannel]);

  await silenced(() => onMessage.execute({}, msg));

  assert.equal(saveCalls.length, 1, '백엔드 저장이 호출되지 않았다');
  assert.equal(calls.reply, 0, '보낼 수 없는 채널에 요청을 보냈다');
  assert.equal(calls.send, 0);
});

test('권한이 있으면 저장 후 등록완료를 답장한다', async () => {
  saveCalls.length = 0;
  const { msg, calls } = makeUpload([
    PermissionsBitField.Flags.ViewChannel,
    PermissionsBitField.Flags.SendMessages,
  ]);

  await onMessage.execute({}, msg);

  assert.equal(saveCalls.length, 1);
  assert.equal(calls.reply, 1);
});

// 첨부 메시지의 첫 토큰이 정확히 !스크림/!대회일 때만 유형이 바뀐다 (TRC-283).
const uploadTagged = async (content) => {
  saveCalls.length = 0;
  const replies = [];
  const { msg } = makeUpload(
    [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
    content,
  );
  msg.reply = async (text) => { replies.push(text); };
  await onMessage.execute({}, msg);
  return { gameType: saveCalls[0]?.[4], reply: replies[0] };
};

test('!스크림 / !대회 첨부는 해당 유형으로 저장하고 응답에 유형을 표시한다', async () => {
  const originalSave = require.cache[replayServicePath].exports.save;
  require.cache[replayServicePath].exports.save = async (...args) => {
    saveCalls.push(args);
    return { replayCode: 'RPY-1', competitionName: '멸망전 1회' };
  };
  try {
    const scrim = await uploadTagged('!스크림');
    assert.equal(scrim.gameType, '2');
    assert.match(scrim.reply, /등록완료\(스크림 · 멸망전 1회\)/);

    const main = await uploadTagged('!대회 오늘 결승');
    assert.equal(main.gameType, '3');
    assert.match(main.reply, /등록완료\(본경기 · 멸망전 1회\)/);
  } finally {
    require.cache[replayServicePath].exports.save = originalSave;
  }
});

test('명령이 없거나 다른 명령이면 일반내전으로 저장한다', async () => {
  assert.equal((await uploadTagged('')).gameType, '1');
  assert.equal((await uploadTagged('오늘 내전 리플')).gameType, '1');
  // startsWith 판정이면 !대회개설이 본경기로 오태깅된다
  assert.equal((await uploadTagged('!대회개설 멸망전 2회')).gameType, '1');
  assert.doesNotMatch((await uploadTagged('')).reply, /등록완료\(/);
});

// 원인이 다르면 사용자가 할 일도 다르다 — 재시도, 파일 축소, 관리자 호출로 갈린다.
const { BotError } = require('../utils/errors');

const { BotErrorType } = require('../utils/errors');

// 실패를 주입해 사용자 응답과 로그를 함께 본다.
const uploadWith = async (error) => {
  const replies = [];
  const logs = [];
  const originalSave = require.cache[replayServicePath].exports.save;
  const { msg } = makeUpload([
    PermissionsBitField.Flags.ViewChannel,
    PermissionsBitField.Flags.SendMessages,
  ]);
  msg.reply = async (text) => { replies.push(text); };

  require.cache[replayServicePath].exports.save = async () => { throw error; };
  const orig = { error: console.error, warn: console.warn };
  console.error = (...a) => logs.push(a); console.warn = () => {};
  try { await onMessage.execute({}, msg); }
  finally {
    Object.assign(console, orig);
    require.cache[replayServicePath].exports.save = originalSave; // 원본 stub 복원
  }
  return { reply: replies[0], logs };
};

test('리플 실패 원인별로 다른 안내를 보낸다', async () => {
  const say = async (error) => (await uploadWith(error)).reply;

  assert.match(await say(new BotError('dup', 400)), /이미 등록된 리플 파일/);
  assert.match(
    await say(new BotError('구형', 400, { type: 'unsupported-replay-version' })),
    /구형 리플 파일/,
  );
  // 같은 400이지만 중복이 아니다 — type으로 갈라야 "이미 등록됨"으로 잘못 안내하지 않는다
  assert.match(
    await say(new BotError('no open', 400, { type: 'no-open-competition' })),
    /진행 중인 대회가 없습니다/,
  );
  assert.match(await say(new BotError('too large', 413)), /파일이 너무 큽니다/);
  assert.match(
    await say(new BotError('오류', 504, { type: 'discord-download-timeout' })),
    /Discord에서 파일을 받아오지 못했습니다/,
  );
  assert.match(
    await say(new BotError('오류', 502, { type: 'discord-download-failed' })),
    /Discord에서 파일을 받아오지 못했습니다/,
  );
  assert.match(
    await say(new BotError('요청 시간 초과', 0, { type: BotErrorType.TIMEOUT })),
    /처리 시간이 초과됐습니다/,
  );
  assert.match(
    await say(new BotError('연결 실패', 0, { type: BotErrorType.UNREACHABLE })),
    /서버에 연결할 수 없습니다/,
  );
  assert.match(await say(new BotError('오류', 500)), /등록실패/);
  assert.match(await say(new TypeError('boom')), /등록실패/);
});

// nginx도 502·504를 낸다. status만 보면 배포 중 pm2 reload가 만든 502를
// Discord 탓으로 돌려, 로그(target=backend)와 사용자 안내가 서로 모순된다.
test('type 없는 502·504는 Discord 탓으로 돌리지 않는다', async () => {
  for (const status of [502, 504]) {
    const { reply } = await uploadWith(new BotError(`HTTP ${status}`, status));
    assert.doesNotMatch(reply, /Discord/, `${status}를 Discord 탓으로 돌렸다`);
    assert.match(reply, /등록실패/);
  }
});

// 우리 계약을 안 따르는 에러가 status 400을 들고 있어도 중복으로 오인하면 안 된다.
test('BotError가 아니면 status가 있어도 중복으로 취급하지 않는다', async () => {
  const foreign = Object.assign(new Error('타사 에러'), { status: 400 });
  const { reply } = await uploadWith(foreign);
  assert.doesNotMatch(reply, /이미 등록된/);
  assert.match(reply, /등록실패/);
});

test('안내로 끝나는 400만 로그를 남기지 않고 나머지는 원인과 함께 남긴다', async () => {
  const dup = await uploadWith(new BotError('dup', 400));
  assert.equal(dup.logs.length, 0, '중복 등록은 정상 결과라 에러 로그를 남기지 않는다');

  const legacy = await uploadWith(new BotError('구형', 400, { type: 'unsupported-replay-version' }));
  assert.equal(legacy.logs.length, 0, '구형 리플도 안내로 끝나는 정상 분기라 로그를 남기지 않는다');

  const failed = await uploadWith(new BotError('오류', 504, { type: 'discord-download-timeout' }));
  assert.equal(failed.logs.length, 1);
  const detail = failed.logs[0][1];
  assert.equal(detail.status, 504);
  assert.equal(detail.guild, 'G_TEST');
  assert.equal(detail.file, 'match'); // 어느 파일인지는 networkUtils 로그에 없다

  // 무로그 대상은 400 하나뿐이다. 다른 상태코드가 여기 섞이면 장애가 조용히 묻힌다.
  for (const error of [
    new BotError('연결 실패', 0, { type: BotErrorType.UNREACHABLE }),
    new BotError('요청 시간 초과', 0, { type: BotErrorType.TIMEOUT }),
    new BotError('오류', 500),
    new BotError('too large', 413),
  ]) {
    const { logs } = await uploadWith(error);
    assert.equal(logs.length >= 1, true, `status ${error.status}(${error.type}) 로그가 없다`);
  }
});
