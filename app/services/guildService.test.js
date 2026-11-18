const test = require('node:test');
const assert = require('node:assert');

process.env.BASE_URL = 'http://test.local/api';

const guildService = require('./guildService');

const makeClient = (guilds) => ({
  guilds: { cache: new Map(guilds.map((g) => [g.id, g])) },
});

const makeMsg = () => {
  const replies = [];
  return {
    replies,
    channel: { id: 'c1', send: async () => {} },
    reply: async (payload) => { replies.push(payload); },
  };
};

const dbGuild = (id, name) => ({
  id, name, createDate: '2026-01-01T00:00:00.000Z', isDeleted: false,
});

const silence = async (fn) => {
  const orig = console.error;
  console.error = () => {};
  try { return await fn(); } finally { console.error = orig; }
};

test('봇이 없는 길드 ID면 leave를 시도하지 않고 안내한다', async () => {
  const msg = makeMsg();
  await guildService.leave_discord_guild(makeClient([]), msg, ['123']);
  assert.strictEqual(msg.replies.length, 1);
  assert.match(String(msg.replies[0]), /봇이 들어가 있지 않은 길드/);
});

test('길드목록은 디스코드 이름과 다른 DB 이름만 PUT으로 갱신하고 갱신된 이름을 보여준다', async () => {
  const requests = [];
  global.fetch = async (url, config) => {
    requests.push({ url: String(url), method: config.method, body: config.body });
    if (config.method === 'GET') {
      return new Response(JSON.stringify({
        data: [dbGuild('1', '옛이름'), dbGuild('2', '그대로'), dbGuild('3', '나간길드')],
      }), { status: 200 });
    }
    return new Response(JSON.stringify({ data: dbGuild('1', JSON.parse(config.body).guildName) }), { status: 200 });
  };
  const client = makeClient([{ id: '1', name: '새이름' }, { id: '2', name: '그대로' }]);

  const result = await guildService.get_guilds_list(client);

  const puts = requests.filter((r) => r.method === 'PUT');
  assert.deepStrictEqual(puts.map((r) => [r.url, JSON.parse(r.body)]), [
    ['http://test.local/api/guilds/1', { guildName: '새이름' }],
  ]);
  const embed = result.embeds[0];
  assert.match(embed.description, /새이름 🔄 \(이전: 옛이름\)/);
  assert.match(embed.description, /나간길드/);
  assert.strictEqual(embed.footer.text, '이름 갱신 1건');
});

test('이름 갱신이 실패해도 목록은 DB 이름으로 보여준다', async () => {
  global.fetch = async (url, config) => {
    if (config.method === 'GET') {
      return new Response(JSON.stringify({ data: [dbGuild('1', '옛이름')] }), { status: 200 });
    }
    return new Response(JSON.stringify({ message: 'boom' }), { status: 500 });
  };
  const client = makeClient([{ id: '1', name: '새이름' }]);

  const result = await silence(() => guildService.get_guilds_list(client));

  const embed = result.embeds[0];
  assert.match(embed.description, /^옛이름 /);
  assert.strictEqual(embed.footer, null);
});

test('PUT이 200이어도 반환된 이름이 그대로면 갱신으로 세지 않는다', async () => {
  global.fetch = async (url, config) => {
    if (config.method === 'GET') {
      return new Response(JSON.stringify({ data: [dbGuild('1', '옛이름')] }), { status: 200 });
    }
    return new Response(JSON.stringify({ data: dbGuild('1', '옛이름') }), { status: 200 });
  };
  const client = makeClient([{ id: '1', name: '새이름' }]);

  const result = await guildService.get_guilds_list(client);

  const embed = result.embeds[0];
  assert.match(embed.description, /^옛이름 /);
  assert.strictEqual(embed.footer, null);
});

test('길드목록은 100개까지 요청하고, 본문이 4096자를 넘으면 개수만 보여준다', async () => {
  const requested = [];
  const many = Array.from({ length: 100 }, (_, i) => dbGuild(String(1e17 + i), `길드${'가'.repeat(30)}${i}`));
  global.fetch = async (url) => {
    requested.push(String(url));
    return new Response(JSON.stringify({ data: many }), { status: 200 });
  };

  const result = await guildService.get_guilds_list(makeClient([]));

  assert.deepStrictEqual(requested, ['http://test.local/api/guilds?limit=100']);
  const embed = result.embeds[0];
  assert.strictEqual(embed.title, 'DB 길드 목록 (총 100개)');
  assert.strictEqual(embed.description, '목록이 길어 개수만 표시합니다.');
});

test('디스코드길드목록은 캐시에서 이름을 읽고 API를 호출하지 않는다', async () => {
  const client = makeClient([{ id: '1', name: '가' }, { id: '2', name: '나' }]);
  client.guilds.fetch = () => { throw new Error('fetch를 부르면 안 된다'); };

  const result = await guildService.show_guild_list(client);

  assert.strictEqual(result, '**가** - 1\n**나** - 2');
});

test('디스코드길드목록은 2000자까지 목록을 보여주고, 넘으면 개수만 보여준다', async () => {
  // 한 줄은 `**이름** - 1`이라 이름 길이 + 8자다.
  const exact = await guildService.show_guild_list(makeClient([{ id: '1', name: '가'.repeat(1992) }]));
  assert.strictEqual(exact.length, 2000);

  const over = await guildService.show_guild_list(makeClient([{ id: '1', name: '가'.repeat(1993) }]));
  assert.strictEqual(over, '봇이 들어가 있는 길드: 총 1개 (목록이 길어 개수만 표시합니다.)');
});

test('이용 불가 길드는 이름 대신 표시를 남긴다', async () => {
  const result = await guildService.show_guild_list(makeClient([{ id: '1', name: undefined }]));

  assert.strictEqual(result, '**(이용 불가)** - 1');
});

const makeNotifyClient = (guilds = []) => {
  const sent = [];
  const channel = { id: 'n1', send: async (payload) => { sent.push(payload); } };
  return {
    sent,
    guilds: { cache: new Map(guilds.map((g) => [g.id, g])) },
    channels: { cache: new Map([['n1', channel]]) },
  };
};

const withNotifyChannel = async (fn) => {
  process.env.GUILD_NOTIFY_CHANNEL_ID = 'n1';
  const origLog = console.log;
  console.log = () => {};
  try { return await fn(); } finally {
    delete process.env.GUILD_NOTIFY_CHANNEL_ID;
    console.log = origLog;
  }
};

const joinedGuild = { id: '9', name: '@everyone 클랜', memberCount: 42 };

const mockGuildApi = ({ getStatus, postBody }) => {
  const requests = [];
  global.fetch = async (url, config) => {
    requests.push(config.method);
    if (config.method === 'GET') {
      return getStatus === 200
        ? new Response(JSON.stringify({ data: dbGuild('9', '클랜') }), { status: 200 })
        : new Response(JSON.stringify({ message: 'Guild not found' }), { status: getStatus });
    }
    return new Response(JSON.stringify({ data: postBody }), { status: 201 });
  };
  return requests;
};

test('초대되면 길드를 등록하고 멘션 없이 알림을 보낸다', async () => {
  const requests = mockGuildApi({ getStatus: 404, postBody: dbGuild('9', '클랜') });
  const client = makeNotifyClient();

  await withNotifyChannel(() => guildService.on_guild_join(client, joinedGuild));

  assert.deepStrictEqual(requests, ['GET', 'POST']);
  assert.match(client.sent[0].content, /^`\d{2}-\d{2} \d{2}:\d{2}` 🟢 \*\*@everyone 클랜\*\* 신규 등록 · 42명 · 9$/);
  assert.deepStrictEqual(client.sent[0].allowedMentions, { parse: [] });
});

test('이미 등록된 길드는 다시 만들지 않는다', async () => {
  const requests = mockGuildApi({ getStatus: 200 });
  const client = makeNotifyClient();

  await withNotifyChannel(() => guildService.on_guild_join(client, joinedGuild));

  assert.deepStrictEqual(requests, ['GET']);
  // 2026-01-01T00:00Z는 KST로 같은 날 09:00이다.
  assert.match(client.sent[0].content, /⚪ .* 다시 초대 \(등록 2026-01-01\) · 42명 · 9$/);
});

test('삭제된 길드에 다시 초대되면 되살리지 않고 알린다', async () => {
  mockGuildApi({ getStatus: 404, postBody: { ...dbGuild('9', '클랜'), isDeleted: true } });
  const client = makeNotifyClient();

  await withNotifyChannel(() => guildService.on_guild_join(client, joinedGuild));

  assert.match(client.sent[0].content, /🟡 .* 삭제된 길드 재초대 · /);
});

test('등록이 실패해도 알림은 보낸다', async () => {
  global.fetch = async () => new Response(JSON.stringify({ message: 'boom' }), { status: 500 });
  const client = makeNotifyClient();

  await silence(() => withNotifyChannel(() => guildService.on_guild_join(client, joinedGuild)));

  assert.match(client.sent[0].content, /❌ .* 등록 실패/);
});

test('알림 채널이 설정되지 않아도 등록은 하고 알림만 건너뛴다', async () => {
  delete process.env.GUILD_NOTIFY_CHANNEL_ID;
  const requests = mockGuildApi({ getStatus: 404, postBody: dbGuild('9', '클랜') });
  const client = makeNotifyClient();

  await silence(async () => {
    const origLog = console.log;
    console.log = () => {};
    try { await guildService.on_guild_join(client, joinedGuild); } finally { console.log = origLog; }
  });

  assert.deepStrictEqual(requests, ['GET', 'POST']);
  assert.strictEqual(client.sent.length, 0);
});

test('퇴장하면 알림만 보내고 백엔드는 호출하지 않는다', async () => {
  const requests = mockGuildApi({ getStatus: 200 });
  const client = makeNotifyClient();

  await withNotifyChannel(() => guildService.on_guild_leave(client, joinedGuild));

  assert.deepStrictEqual(requests, []);
  assert.match(client.sent[0].content, /🔴 .* 나감 · 42명 · 9$/);
});

test('알림의 길드 이름은 마크다운을 이스케이프한다', async () => {
  const client = makeNotifyClient();

  await withNotifyChannel(() => guildService.on_guild_leave(client, { ...joinedGuild, name: '**굵게**' }));

  assert.match(client.sent[0].content, /\*\*\\\*\\\*굵게\\\*\\\*\*\*/);
});

const ownedGuild = (id, ownerId) => ({ id, name: `서버${id}`, memberCount: 42, ownerId });

test('같은 소유자 서버가 이미 2개면 등록하지 않고 나가며 퇴장 알림은 한 번만 보낸다', async () => {
  const requests = mockGuildApi({ getStatus: 404, postBody: dbGuild('9', '클랜') });
  let left = 0;
  const joined = { ...ownedGuild('9', 'o1'), leave: async () => { left += 1; } };
  const client = makeNotifyClient([ownedGuild('1', 'o1'), ownedGuild('2', 'o1'), joined]);

  await withNotifyChannel(async () => {
    await guildService.on_guild_join(client, joined);
    await guildService.on_guild_leave(client, joined);
  });

  assert.strictEqual(left, 1);
  assert.deepStrictEqual(requests, []);
  assert.strictEqual(client.sent.length, 1);
  assert.match(client.sent[0].content, /🚫 .* 자동 퇴장 \(같은 소유자 서버가 이미 2개\)/);
});

test('같은 소유자 서버가 1개뿐이면 정상 등록한다', async () => {
  const requests = mockGuildApi({ getStatus: 404, postBody: dbGuild('9', '클랜') });
  const joined = { ...ownedGuild('9', 'o1'), leave: async () => { throw new Error('나가면 안 된다'); } };
  const client = makeNotifyClient([ownedGuild('1', 'o1'), joined]);

  await withNotifyChannel(() => guildService.on_guild_join(client, joined));

  assert.deepStrictEqual(requests, ['GET', 'POST']);
  assert.match(client.sent[0].content, /신규 등록/);
});

test('봇 관리자 소유 서버는 개수 제한을 받지 않는다', async () => {
  mockGuildApi({ getStatus: 404, postBody: dbGuild('9', '클랜') });
  process.env.ADMIN_ID = 'admin';
  const joined = { ...ownedGuild('9', 'admin'), leave: async () => { throw new Error('나가면 안 된다'); } };
  const client = makeNotifyClient([ownedGuild('1', 'admin'), ownedGuild('2', 'admin'), joined]);

  try {
    await withNotifyChannel(() => guildService.on_guild_join(client, joined));
  } finally {
    delete process.env.ADMIN_ID;
  }

  assert.match(client.sent[0].content, /신규 등록/);
});

test('멤버 5명 미만 서버는 새로 등록하지 않고 보류한다', async () => {
  const requests = mockGuildApi({ getStatus: 404, postBody: dbGuild('9', '클랜') });
  const client = makeNotifyClient();

  await withNotifyChannel(() => guildService.on_guild_join(client, { ...joinedGuild, memberCount: 4 }));

  assert.deepStrictEqual(requests, ['GET']);
  assert.match(client.sent[0].content, /⏸️ .* 등록 보류 \(멤버 5명 미만, 첫 리플 업로드 때 등록\) · 4명/);
});

test('멤버가 적어도 이미 등록된 길드는 다시 초대로 표시한다', async () => {
  mockGuildApi({ getStatus: 200 });
  const client = makeNotifyClient();

  await withNotifyChannel(() => guildService.on_guild_join(client, { ...joinedGuild, memberCount: 2 }));

  assert.match(client.sent[0].content, /다시 초대/);
});

test('자동 퇴장이 실패하면 실패를 알리고, 이후 퇴장 알림은 정상으로 보낸다', async () => {
  const requests = mockGuildApi({ getStatus: 404, postBody: dbGuild('9', '클랜') });
  const joined = { ...ownedGuild('9', 'o1'), leave: async () => { throw new Error('boom'); } };
  const client = makeNotifyClient([ownedGuild('1', 'o1'), ownedGuild('2', 'o1'), joined]);

  await silence(() => withNotifyChannel(async () => {
    await guildService.on_guild_join(client, joined);
    await guildService.on_guild_leave(client, joined);
  }));

  assert.deepStrictEqual(requests, []);
  assert.strictEqual(client.sent.length, 2);
  assert.match(client.sent[0].content, /❌ .* 자동 퇴장 실패/);
  assert.match(client.sent[1].content, /🔴 .* 나감/);
});

test('재시도가 Unknown Guild로 실패하면 이미 나간 것으로 보고 자동 퇴장으로 알린다', async () => {
  mockGuildApi({ getStatus: 404, postBody: dbGuild('9', '클랜') });
  const joined = {
    ...ownedGuild('9', 'o1'),
    leave: async () => { throw Object.assign(new Error('Unknown Guild'), { code: 10004 }); },
  };
  const client = makeNotifyClient([ownedGuild('1', 'o1'), ownedGuild('2', 'o1'), joined]);

  await withNotifyChannel(async () => {
    await guildService.on_guild_join(client, joined);
    await guildService.on_guild_leave(client, joined);
  });

  assert.strictEqual(client.sent.length, 1);
  assert.match(client.sent[0].content, /🚫 .* 자동 퇴장/);
});

test('자동 퇴장 뒤 GuildDelete를 놓쳐도 다시 초대된 서버의 퇴장 알림은 나간다', async () => {
  mockGuildApi({ getStatus: 404, postBody: dbGuild('9', '클랜') });
  const joined = { ...ownedGuild('9', 'o1'), leave: async () => {} };

  await withNotifyChannel(async () => {
    await guildService.on_guild_join(makeNotifyClient([ownedGuild('1', 'o1'), ownedGuild('2', 'o1'), joined]), joined);
    const client = makeNotifyClient([joined]);
    await guildService.on_guild_join(client, joined);
    await guildService.on_guild_leave(client, joined);
    assert.match(client.sent[1].content, /🔴 .* 나감/);
  });
});

test('멤버가 정확히 5명이면 등록한다', async () => {
  const requests = mockGuildApi({ getStatus: 404, postBody: dbGuild('9', '클랜') });
  const client = makeNotifyClient();

  await withNotifyChannel(() => guildService.on_guild_join(client, { ...joinedGuild, memberCount: 5 }));

  assert.deepStrictEqual(requests, ['GET', 'POST']);
});

test('소유자를 알 수 없는 서버는 개수 제한 없이 등록한다', async () => {
  mockGuildApi({ getStatus: 404, postBody: dbGuild('9', '클랜') });
  const joined = { ...ownedGuild('9', undefined), leave: async () => { throw new Error('나가면 안 된다'); } };
  const client = makeNotifyClient([ownedGuild('1', undefined), ownedGuild('2', undefined), joined]);

  await withNotifyChannel(() => guildService.on_guild_join(client, joined));

  assert.match(client.sent[0].content, /신규 등록/);
});
