const test = require('node:test');
const assert = require('node:assert');
const { PermissionsBitField } = require('discord.js');
const { canSend, safeReply, missingPermissions, unreachable } = require('./discordUtils');

// console.warn을 가로채 로그 내용까지 검증한다.
const captureWarn = async (fn) => {
  const lines = [];
  const original = console.warn;
  console.warn = (...args) => lines.push(args);
  try { await fn(); } finally { console.warn = original; }
  return lines;
};

const { ViewChannel, SendMessages, SendMessagesInThreads, AttachFiles } = PermissionsBitField.Flags;

const VIEW_ONLY = [ViewChannel];
const FULL = [ViewChannel, SendMessages];

const apiError = (code, rawError = {}) => Object.assign(new Error('api'), { code, rawError });

// 운영 로그의 `message_reference[MESSAGE_REFERENCE_UNKNOWN_MESSAGE]: Unknown message` 는
// discord.js flattenDiscordError가 `key[code]: message` 로 만든 것이다. 그 역산 형태.
const STALE_REFERENCE_RAW = {
  code: 50035,
  message: 'Invalid Form Body',
  errors: {
    message_reference: {
      _errors: [{ code: 'MESSAGE_REFERENCE_UNKNOWN_MESSAGE', message: 'Unknown message' }],
    },
  },
};

const makeMsg = (perms, opts = {}) => {
  const { replyErr, sendErr, dmErr, channelId = 'C1', isThread = false, noChannel = false } = opts;
  const calls = { reply: 0, send: 0, dm: 0 };
  const channel = noChannel ? null : {
    id: channelId,
    isTextBased: () => true,
    isThread: () => isThread,
    guild: { members: { me: {} } },
    permissionsFor: () => new PermissionsBitField(perms),
    send: async () => { calls.send++; if (sendErr) throw sendErr; },
  };
  const msg = {
    channel,
    guild: { id: 'G1' },
    client: { channels: { cache: new Map() } },
    author: { send: async () => { calls.dm++; if (dmErr) throw dmErr; } },
    reply: async () => { calls.reply++; if (replyErr) throw replyErr; },
  };
  return { calls, msg };
};

test('SendMessages가 없으면 canSend가 false다', () => {
  const { msg } = makeMsg(VIEW_ONLY);
  assert.equal(canSend(msg.channel), false);
});

test('첨부가 있으면 AttachFiles까지 요구한다', () => {
  const { msg } = makeMsg(FULL);
  assert.equal(canSend(msg.channel, 'text'), true);
  assert.equal(canSend(msg.channel, { files: [{}] }), false);
  const withFiles = makeMsg([...FULL, AttachFiles]).msg;
  assert.equal(canSend(withFiles.channel, { files: [{}] }), true);
});

// 스레드는 SendMessages가 아니라 SendMessagesInThreads를 본다.
// 구분하지 않으면 보낼 수 있는 스레드에서도 폴백해버린다.
test('스레드에서는 SendMessagesInThreads로 판정한다', () => {
  const inThread = makeMsg([ViewChannel, SendMessagesInThreads], { isThread: true }).msg;
  assert.equal(canSend(inThread.channel), true);

  const parentOnly = makeMsg(FULL, { isThread: true }).msg;
  assert.equal(canSend(parentOnly.channel), false);
});

test('전송 권한이 없으면 답장을 시도조차 않고 DM으로 폴백한다', async () => {
  const { msg, calls } = makeMsg(VIEW_ONLY);
  assert.equal(await safeReply(msg, 'hi'), true);
  assert.equal(calls.reply, 0); // 실패할 요청을 보내지 않는다
  assert.equal(calls.dm, 1);
});

// 폴백이 조용히 성공하면 깨진 채널 권한을 영원히 모른다.
test('DM 폴백 시 빠진 권한을 로그로 남긴다', async () => {
  const { msg } = makeMsg(VIEW_ONLY);
  const lines = await captureWarn(() => safeReply(msg, 'hi'));

  assert.equal(lines.length, 1);
  const [label, detail] = lines[0];
  assert.match(label, /DM 폴백/);
  assert.deepEqual(detail.missing, ['SendMessages']);
  assert.equal(detail.delivered, true);
  assert.equal(detail.guild, 'G1');
});

test('missingPermissions가 첨부·스레드 요구 권한까지 짚어준다', () => {
  const plain = makeMsg(VIEW_ONLY).msg.channel;
  assert.deepEqual(missingPermissions(plain, 'hi'), ['SendMessages']);
  assert.deepEqual(missingPermissions(plain, { files: [{}] }), ['SendMessages', 'AttachFiles']);

  const thread = makeMsg(VIEW_ONLY, { isThread: true }).msg.channel;
  assert.deepEqual(missingPermissions(thread, 'hi'), ['SendMessagesInThreads']);

  assert.deepEqual(missingPermissions(null, 'hi'), ['NO_CHANNEL']);
});

test('50013이면 DM으로 폴백한다', async () => {
  const { msg, calls } = makeMsg(FULL, { replyErr: apiError(50013) });
  assert.equal(await safeReply(msg, 'hi'), true);
  assert.equal(calls.dm, 1);
});

// 권한 오류로 채널을 영구 차단하면 운영자가 권한을 되돌려도 재시작 전까지 침묵한다.
test('권한 오류(50013/50001)는 채널을 영구 차단하지 않는다', async () => {
  unreachable.clear();
  try {
    for (const code of [50013, 50001]) {
      const { msg } = makeMsg(FULL, { replyErr: apiError(code), channelId: `C_${code}` });
      await safeReply(msg, 'hi');
      assert.equal(unreachable.has(`C_${code}`), false, `${code}가 차단됐다`);
    }
  } finally {
    unreachable.clear();
  }
});

// 원본 메시지가 지워져도 알림 자체는 채널에 남아야 한다.
test('50035 message_reference면 일반 전송으로 폴백한다', async () => {
  const { msg, calls } = makeMsg(FULL, { replyErr: apiError(50035, STALE_REFERENCE_RAW) });
  assert.equal(await safeReply(msg, 'hi'), true);
  assert.equal(calls.send, 1);
  assert.equal(calls.dm, 0);
});

test('message_reference_id 변형도 답장 실패로 인식한다', async () => {
  const raw = { code: 50035, errors: { message_reference_id: { _errors: [{ code: 'REPLIES_UNKNOWN_MESSAGE' }] } } };
  const { msg, calls } = makeMsg(FULL, { replyErr: apiError(50035, raw) });
  assert.equal(await safeReply(msg, 'hi'), true);
  assert.equal(calls.send, 1);
});

// message_reference와 무관한 50035는 진짜 페이로드 버그이므로 숨기지 않는다.
test('50035라도 message_reference가 아니면 전송 폴백하지 않는다', async () => {
  const raw = { code: 50035, errors: { content: { _errors: [{ code: 'BASE_TYPE_MAX_LENGTH' }] } } };
  const { msg, calls } = makeMsg(FULL, { replyErr: apiError(50035, raw) });
  assert.equal(await safeReply(msg, 'hi'), false);
  assert.equal(calls.send, 0);
  assert.equal(calls.dm, 0);
});

test('모든 경로가 실패해도 예외를 던지지 않는다', async () => {
  const { msg } = makeMsg(FULL, { replyErr: apiError(50013), dmErr: apiError(50007) });
  assert.equal(await safeReply(msg, 'hi'), false);
});

// Partials.Channel 사용 시 msg.channel이 null일 수 있다.
test('채널이 null이어도 던지지 않고 DM으로 간다', async () => {
  const { msg, calls } = makeMsg(FULL, { noChannel: true });
  assert.equal(await safeReply(msg, 'hi'), true);
  assert.equal(calls.dm, 1);
});

test('직렬화 불가한 rawError에도 던지지 않는다', async () => {
  const { msg } = makeMsg(FULL, { replyErr: apiError(50035, { big: 1n }) });
  assert.equal(await safeReply(msg, 'hi'), false);
});

test('10003이면 채널을 전송 대상에서 영구 제외하고 DM으로 폴백한다', async () => {
  unreachable.clear();
  try {
    const { msg, calls } = makeMsg(FULL, { replyErr: apiError(10003), channelId: 'C_GONE' });
    assert.equal(await safeReply(msg, 'hi'), true);
    assert.equal(calls.dm, 1); // 첫 사용자도 그냥 버려지지 않는다
    assert.ok(unreachable.has('C_GONE'));

    const before = calls.reply;
    await safeReply(msg, 'again');
    assert.equal(calls.reply, before); // 두 번째부터는 시도하지 않는다
  } finally {
    unreachable.clear();
  }
});
