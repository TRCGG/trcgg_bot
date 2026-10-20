const test = require('node:test');
const assert = require('node:assert');
const store = require('./recruitStore');
const service = require('./recruitService');

let seq = 0;
const openRecruit = (overrides = {}) => {
	const { recruit } = store.open({
		guildId: `g-${seq + 1}`,
		channelId: `svc-${++seq}`,
		hostId: 'host',
		hostName: '개최자',
		capacity: 10,
		memo: '',
		...overrides,
	});
	recruit.messageId = 'm1';
	return recruit;
};

const fill = (recruit, count, name = (i) => `유저${i}`) => {
	for (let i = 1; i <= count; i++) store.join(recruit, { userId: `u${i}`, name: name(i) });
};

const interactionFor = (recruit, { customId, userId = 'host', values = [], edits }) => {
	const calls = [];
	const channel = {
		messages: {
			// 먼저 보낸 요청이 늦게 도착하는 상황을 만든다.
			edit: async (id, payload) => {
				await new Promise((r) => setTimeout(r, edits.length === 0 ? 30 : 0));
				edits.push(payload);
			},
		},
	};
	return {
		calls,
		isButton: () => true,
		isStringSelectMenu: () => false,
		customId,
		values,
		channelId: recruit.channelId,
		channel,
		user: { id: userId, username: userId },
		member: { displayName: userId },
		replied: false,
		deferred: false,
		reply: async (p) => calls.push(['reply', p]),
		update: async (p) => calls.push(['update', p]),
		followUp: async (p) => calls.push(['followUp', p]),
	};
};

test('긴 닉네임·특수문자로 꽉 찬 모집도 모든 필드가 1024자 이내', () => {
	const r = openRecruit({ capacity: 40 });
	fill(r, 70, (i) => `${'_'.repeat(30)}${i}`);
	const fields = service.buildPanel(r).embeds[0].toJSON().fields;
	for (const field of fields) assert.ok(field.value.length <= 1024, `${field.name}: ${field.value.length}`);
	assert.match(fields.at(-1).value, /…외 \d+명$/);
});

test('25명이 넘으면 추방 셀렉트를 25명씩 나누고 100명을 넘으면 안내한다', () => {
	const r = openRecruit({ capacity: 40 });
	fill(r, 60);
	const view = service.buildManageView(r);
	const selects = view.components.slice(0, -1).map((row) => row.toJSON().components[0]);
	assert.deepStrictEqual(selects.map((s) => s.options.length), [25, 25, 10]);
	assert.strictEqual(new Set(selects.map((s) => s.custom_id)).size, 3);

	fill(r, 120);
	const big = service.buildManageView(r);
	assert.strictEqual(big.components.length, 5);
	assert.match(big.content, /앞 100명까지만/);
});

test('동시 참가 시 패널은 마지막에 최신 상태로 그려진다', async () => {
	const r = openRecruit();
	const edits = [];
	await Promise.all(
		['a', 'b', 'c'].map((userId) =>
			service.handleRecruitInteraction(interactionFor(r, { customId: `recruit:join:${r.id}`, userId, edits })),
		),
	);
	assert.strictEqual(edits.at(-1).embeds[0].toJSON().title, `⚔️ ${r.round}차 내전 모집 (3/10)`);
});

test('종료 직후 늦게 처리된 참가가 패널을 다시 열린 모양으로 되돌리지 않는다', async () => {
	const r = openRecruit();
	const edits = [];
	const join = service.handleRecruitInteraction(interactionFor(r, { customId: `recruit:join:${r.id}`, userId: 'a', edits }));
	const end = service.handleRecruitInteraction(interactionFor(r, { customId: `recruit:end:${r.id}`, edits }));
	await Promise.all([join, end]);
	const last = edits.at(-1);
	assert.match(last.embeds[0].toJSON().title, /^✅ \d+차 내전 모집 종료/);
	assert.deepStrictEqual(last.components, []);
});

test('개최자도 관리자도 아니면 관리할 수 없다', async () => {
	const r = openRecruit();
	const interaction = interactionFor(r, { customId: `recruit:close:${r.id}`, userId: 'stranger', edits: [] });
	interaction.member = { displayName: 'x', roles: { cache: { some: () => false } }, permissions: { has: () => false } };
	await service.handleRecruitInteraction(interaction);
	assert.strictEqual(r.closed, false);
	assert.match(interaction.calls[0][1].content, /개최자 또는 관리자만/);
});

test('다른 접두어의 customId는 처리하지 않는다', async () => {
	const handled = await service.handleRecruitInteraction({
		isButton: () => true, isStringSelectMenu: () => false, customId: 'select_language',
	});
	assert.strictEqual(handled, false);
});

test('개최자는 자기가 연 모집만 관리할 수 있다', async () => {
	const noRole = { displayName: 'x', roles: { cache: { some: () => false } }, permissions: { has: () => false } };
	const mine = openRecruit({ hostId: 'alice' });
	const others = openRecruit({ hostId: 'bob' });

	const onMine = interactionFor(mine, { customId: `recruit:close:${mine.id}`, userId: 'alice', edits: [] });
	onMine.member = noRole;
	await service.handleRecruitInteraction(onMine);
	assert.strictEqual(mine.closed, true);

	const onOthers = interactionFor(others, { customId: `recruit:close:${others.id}`, userId: 'alice', edits: [] });
	onOthers.member = noRole;
	await service.handleRecruitInteraction(onOthers);
	assert.strictEqual(others.closed, false);
	assert.match(onOthers.calls[0][1].content, /개최자 또는 관리자만/);
});

test('명단 복사는 닉네임 목록 아래에 멘션 텍스트를 붙이고, 2000자를 넘으면 두 메시지로 나눈다', async () => {
	const small = openRecruit();
	fill(small, 3);
	const a = interactionFor(small, { customId: `recruit:copy:${small.id}`, userId: 'x', edits: [] });
	await service.handleRecruitInteraction(a);
	assert.strictEqual(a.calls.length, 1);
	assert.match(a.calls[0][1].content, /유저1\n유저2\n유저3[\s\S]*<@u1> <@u2> <@u3>/);
	assert.deepStrictEqual(a.calls[0][1].allowedMentions, { parse: [] });

	const big = openRecruit({ capacity: 40 });
	for (let i = 1; i <= 40; i++) store.join(big, { userId: `${10n ** 18n + BigInt(i)}`, name: `${'가'.repeat(31)}${i}` });
	const b = interactionFor(big, { customId: `recruit:copy:${big.id}`, userId: 'x', edits: [] });
	await service.handleRecruitInteraction(b);
	assert.deepStrictEqual(b.calls.map(([kind]) => kind), ['reply', 'followUp']);
	for (const [, payload] of b.calls) assert.ok(payload.content.length <= 2000, String(payload.content.length));
	assert.match(b.calls[1][1].content, /전체 멘션/);
});

const withNotify = (interaction, { dmBlocked = [] } = {}) => {
	const dms = [];
	const channelSends = [];
	interaction.client = {
		users: {
			send: async (userId, text) => {
				if (dmBlocked.includes(userId)) throw Object.assign(new Error('Cannot send messages to this user'), { code: 50007 });
				dms.push([userId, text]);
			},
		},
	};
	interaction.guild = { name: '테스트서버' };
	interaction.channel.id = interaction.channelId;
	interaction.channel.send = async (payload) => channelSends.push(payload);
	return { dms, channelSends };
};

test('참가자가 취소해 대기자가 올라가면 DM을 보내고 채널엔 남기지 않는다', async () => {
	const r = openRecruit({ capacity: 2 });
	fill(r, 3);
	const interaction = interactionFor(r, { customId: `recruit:leave:${r.id}`, userId: 'u1', edits: [] });
	const { dms, channelSends } = withNotify(interaction);
	await service.handleRecruitInteraction(interaction);
	assert.strictEqual(dms.length, 1);
	assert.strictEqual(dms[0][0], 'u3');
	assert.match(dms[0][1], /테스트서버.*\d+차 내전 모집에서 대기 → 참가/);
	assert.deepStrictEqual(channelSends, []);
});

test('여러 명 추방으로 승급 시 DM이 막힌 사람만 채널에서 멘션한다', async () => {
	const r = openRecruit({ capacity: 2 });
	fill(r, 4);
	const interaction = interactionFor(r, { customId: `recruit:kick:${r.id}:0`, values: ['u1', 'u2'], edits: [] });
	interaction.isButton = () => false;
	interaction.isStringSelectMenu = () => true;
	const { dms, channelSends } = withNotify(interaction, { dmBlocked: ['u4'] });
	await service.handleRecruitInteraction(interaction);
	assert.deepStrictEqual(dms.map(([id]) => id), ['u3']);
	assert.strictEqual(channelSends.length, 2);
	assert.match(channelSends[0].content, /^🚫/);
	assert.match(channelSends[1].content, /^<@u4> ⬆️/);
	assert.deepStrictEqual(channelSends[1].allowedMentions, { users: ['u4'] });
});

test('대기자가 취소하면 아무에게도 알림이 가지 않는다', async () => {
	const r = openRecruit({ capacity: 1 });
	fill(r, 2);
	const interaction = interactionFor(r, { customId: `recruit:leave:${r.id}`, userId: 'u2', edits: [] });
	const { dms, channelSends } = withNotify(interaction);
	await service.handleRecruitInteraction(interaction);
	assert.deepStrictEqual([dms, channelSends], [[], []]);
});

test('응답이 실패(10062)해도 패널은 갱신된다', async () => {
	const r = openRecruit();
	const edits = [];
	const interaction = interactionFor(r, { customId: `recruit:join:${r.id}`, userId: 'a', edits });
	interaction.reply = async () => { throw Object.assign(new Error('Unknown interaction'), { code: 10062 }); };
	await service.handleRecruitInteraction(interaction);
	assert.strictEqual(r.participants.length, 1);
	assert.strictEqual(edits.at(-1).embeds[0].toJSON().title, `⚔️ ${r.round}차 내전 모집 (1/10)`);
});

test('패널 채널이 삭제(10003)되면 모집을 정리해 서버 자리를 비운다', async () => {
	const r = openRecruit();
	const interaction = interactionFor(r, { customId: `recruit:join:${r.id}`, userId: 'a', edits: [] });
	interaction.channel.messages.edit = async () => { throw Object.assign(new Error('Unknown Channel'), { code: 10003 }); };
	await service.handleRecruitInteraction(interaction);
	assert.strictEqual(store.find(r.channelId, r.id), null);
	assert.deepStrictEqual(store.activeInGuild(r.guildId), []);
});

test('한 번에 6명 이상 올라가면 DM 없이 채널 멘션으로만 알린다', async () => {
	const r = openRecruit({ capacity: 6 });
	fill(r, 12);
	const kicked = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'];
	const interaction = interactionFor(r, { customId: `recruit:kick:${r.id}:0`, values: kicked, edits: [] });
	interaction.isButton = () => false;
	interaction.isStringSelectMenu = () => true;
	const { dms, channelSends } = withNotify(interaction);
	await service.handleRecruitInteraction(interaction);
	assert.deepStrictEqual(dms, []);
	assert.strictEqual(channelSends.length, 2);
	assert.deepStrictEqual(channelSends[1].allowedMentions.users, ['u7', 'u8', 'u9', 'u10', 'u11', 'u12']);
});

const kickBy = async (recruit, actorId, values, member) => {
	const interaction = interactionFor(recruit, { customId: `recruit:kick:${recruit.id}:0`, userId: actorId, values, edits: [] });
	interaction.isButton = () => false;
	interaction.isStringSelectMenu = () => true;
	if (member) interaction.member = member;
	const sent = withNotify(interaction);
	await service.handleRecruitInteraction(interaction);
	return sent.channelSends;
};

test('추방하면 누가 누구를 뺐는지 채널에 공개로 남기고 멘션 알림은 보내지 않는다', async () => {
	const r = openRecruit({ hostId: 'host' });
	fill(r, 3);
	const [notice] = await kickBy(r, 'host', ['u1', 'u3'], { displayName: '케이오' });
	assert.strictEqual(notice.content, `🚫 [${r.round}차 내전] 개최자 케이오님이 유저1, 유저3님을 추방했습니다.`);
	assert.deepStrictEqual(notice.allowedMentions, { parse: [] });
});

test('개최자가 아닌 관리자가 추방하면 관리자로 표시한다', async () => {
	const r = openRecruit({ hostId: 'host' });
	fill(r, 2);
	const admin = { displayName: '운영진', roles: { cache: { some: () => true } }, permissions: { has: () => false } };
	const [notice] = await kickBy(r, 'admin', ['u1'], admin);
	assert.match(notice.content, /관리자 운영진님이 유저1님을 추방/);
});

test('이미 나간 인원을 고르면 추방 기록을 남기지 않는다', async () => {
	const r = openRecruit();
	fill(r, 1);
	store.leave(r, 'u1');
	assert.deepStrictEqual(await kickBy(r, 'host', ['u1']), []);
});
