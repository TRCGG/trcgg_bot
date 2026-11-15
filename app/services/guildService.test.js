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
