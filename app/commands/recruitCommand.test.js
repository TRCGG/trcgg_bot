const test = require('node:test');
const assert = require('node:assert');
const store = require('../services/recruitStore');
const [recruitCommand] = require('./recruitCommand');

let seq = 0;
const makeMsg = ({ guildId = `cmd-g${++seq}`, channelId = `cmd-ch${seq}`, fetchChannel } = {}) => {
	const replies = [];
	const posts = [];
	return {
		replies,
		posts,
		guild: { id: guildId },
		author: { id: 'host', username: 'host' },
		member: { displayName: '개최자' },
		channel: {
			id: channelId,
			send: async (payload) => {
				posts.push(payload);
				return { id: `msg-${posts.length}` };
			},
		},
		client: { channels: { fetch: fetchChannel ?? (async () => ({ messages: { fetch: async () => ({}) } })) } },
		reply: async (payload) => replies.push(payload),
	};
};

const titleOf = (msg) => msg.posts.at(-1).embeds[0].toJSON().title;
const descOf = (msg) => msg.posts.at(-1).embeds[0].toJSON().description;

test('인원은 숫자나 "N명"으로 받고 나머지는 메모', async () => {
	const msg = makeMsg();
	await recruitCommand.run(null, msg, ['8명', '21시', '시작']);
	assert.match(titleOf(msg), /\(0\/8\)/);
	assert.match(descOf(msg), /21시 시작/);
});

test('인원 없이 메모만 쓰면 정원 10', async () => {
	const msg = makeMsg();
	await recruitCommand.run(null, msg, ['21시']);
	assert.match(titleOf(msg), /\(0\/10\)/);
});

test('인원이 2~40을 벗어나면 안내하고 열지 않는다', async () => {
	const msg = makeMsg();
	await recruitCommand.run(null, msg, ['41']);
	assert.strictEqual(msg.posts.length, 0);
	assert.match(msg.replies[0], /2~40/);
});

test('메모는 문자 단위로 100자까지 자른다(이모지를 반으로 자르지 않는다)', async () => {
	const msg = makeMsg();
	await recruitCommand.run(null, msg, ['😀'.repeat(150)]);
	assert.ok(descOf(msg).includes('😀'.repeat(100)));
	assert.ok(!descOf(msg).includes('😀'.repeat(101)));
});

test('서버에 5개가 열려 있으면 채널·개최자와 함께 안내한다', async () => {
	const guildId = 'cmd-limit';
	for (let i = 0; i < 5; i++) await recruitCommand.run(null, makeMsg({ guildId, channelId: `lim-${i}` }), []);
	const msg = makeMsg({ guildId });
	await recruitCommand.run(null, msg, []);
	assert.strictEqual(msg.posts.length, 0);
	assert.match(msg.replies[0], /최대 5개/);
	assert.match(msg.replies[0], /<#lim-0> · 개최자/);
});

test('5개 중 패널 채널이 삭제된 모집은 정리하고 연다', async () => {
	const guildId = 'cmd-prune';
	for (let i = 0; i < 5; i++) await recruitCommand.run(null, makeMsg({ guildId, channelId: `prune-${i}` }), []);
	const gone = async (id) => {
		if (id === 'prune-0') throw Object.assign(new Error('Unknown Channel'), { code: 10003 });
		return { messages: { fetch: async () => ({}) } };
	};
	const msg = makeMsg({ guildId, fetchChannel: gone });
	await recruitCommand.run(null, msg, []);
	assert.strictEqual(msg.posts.length, 1);
	assert.strictEqual(store.activeInGuild(guildId).length, 5);
});
