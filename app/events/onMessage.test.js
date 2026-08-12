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

const makeUpload = (perms) => {
  const calls = { reply: 0, send: 0 };
  return {
    calls,
    msg: {
      inGuild: () => true,
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

// 원인이 다르면 사용자가 할 일도 다르다 — 재시도, 파일 축소, 관리자 호출로 갈린다.
const { BotError } = require('../utils/errors');

const uploadWith = async (error) => {
  const replies = [];
  saveCalls.length = 0;
  const { msg } = makeUpload([
    PermissionsBitField.Flags.ViewChannel,
    PermissionsBitField.Flags.SendMessages,
  ]);
  msg.reply = async (text) => { replies.push(text); };

  require.cache[replayServicePath].exports.save = async () => { throw error; };
  const orig = { error: console.error, warn: console.warn };
  console.error = () => {}; console.warn = () => {};
  try { await onMessage.execute({}, msg); } finally { Object.assign(console, orig); }

  require.cache[replayServicePath].exports.save = async () => {
    saveCalls.push([]); return { replayCode: 'RPY-x' };
  };
  return replies[0];
};

test('리플 실패 원인별로 다른 안내를 보낸다', async () => {
  assert.match(await uploadWith(new BotError('dup', 400)), /이미 등록된 리플 파일/);
  assert.match(await uploadWith(new BotError('too large', 413)), /파일이 너무 큽니다/);
  assert.match(
    await uploadWith(new BotError('오류', 504, { type: 'discord-download-timeout' })),
    /Discord에서 파일을 받아오지 못했습니다/,
  );
  assert.match(
    await uploadWith(new BotError('오류', 502, { type: 'discord-download-failed' })),
    /Discord에서 파일을 받아오지 못했습니다/,
  );
  assert.match(await uploadWith(new BotError('연결 실패', 0)), /서버에 연결할 수 없습니다/);
  assert.match(await uploadWith(new BotError('오류', 500)), /등록실패/);
  assert.match(await uploadWith(new TypeError('boom')), /등록실패/);
});
