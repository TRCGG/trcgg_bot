const test = require('node:test');
const assert = require('node:assert');
const store = require('./recruitStore');

let seq = 0;
const openRecruit = (overrides = {}) =>
	store.open({
		guildId: `g-${seq + 1}`,
		channelId: `ch-${++seq}`,
		hostId: 'host',
		hostName: '개최자',
		capacity: 3,
		memo: '',
		...overrides,
	}).recruit;

const user = (n) => ({ userId: `u${n}`, name: `유저${n}` });
const names = (list) => list.map((m) => m.name);

test('정원까지는 참가, 넘으면 대기 명단 끝에 붙는다', () => {
	const r = openRecruit();
	assert.deepStrictEqual(store.join(r, user(1)), { status: 'JOINED', position: 1 });
	store.join(r, user(2));
	store.join(r, user(3));
	assert.deepStrictEqual(store.join(r, user(4)), { status: 'WAITLISTED', position: 1 });
	assert.deepStrictEqual(store.join(r, user(5)), { status: 'WAITLISTED', position: 2 });
	assert.deepStrictEqual(names(r.participants), ['유저1', '유저2', '유저3']);
	assert.deepStrictEqual(names(r.waitlist), ['유저4', '유저5']);
});

test('참가 중이거나 대기 중이면 다시 넣지 않는다', () => {
	const r = openRecruit({ capacity: 1 });
	store.join(r, user(1));
	store.join(r, user(2));
	assert.strictEqual(store.join(r, user(1)).status, 'ALREADY_IN');
	assert.strictEqual(store.join(r, user(2)).status, 'ALREADY_IN');
});

test('참가자가 취소하면 대기 1번이 승급한다', () => {
	const r = openRecruit({ capacity: 2 });
	[1, 2, 3, 4].forEach((n) => store.join(r, user(n)));
	const result = store.leave(r, 'u1');
	assert.strictEqual(result.status, 'LEFT');
	assert.deepStrictEqual(names(result.promoted), ['유저3']);
	assert.deepStrictEqual(names(r.participants), ['유저2', '유저3']);
	assert.deepStrictEqual(names(r.waitlist), ['유저4']);
});

test('대기자가 취소하면 승급 없이 빠진다', () => {
	const r = openRecruit({ capacity: 1 });
	[1, 2, 3].forEach((n) => store.join(r, user(n)));
	const result = store.leave(r, 'u2');
	assert.strictEqual(result.status, 'LEFT');
	assert.deepStrictEqual(result.promoted, []);
	assert.deepStrictEqual(names(r.waitlist), ['유저3']);
});

test('명단에 없는 사람의 취소는 NOT_IN', () => {
	const r = openRecruit();
	assert.strictEqual(store.leave(r, 'nobody').status, 'NOT_IN');
});

test('여러 명 추방 시 빈 자리만큼 대기자가 순서대로 승급한다', () => {
	const r = openRecruit({ capacity: 3 });
	[1, 2, 3, 4, 5, 6].forEach((n) => store.join(r, user(n)));
	const { removed, promoted } = store.kick(r, ['u1', 'u3', 'u5']);
	assert.deepStrictEqual(names(removed), ['유저1', '유저3', '유저5']);
	assert.deepStrictEqual(names(promoted), ['유저4', '유저6']);
	assert.deepStrictEqual(names(r.participants), ['유저2', '유저4', '유저6']);
	assert.deepStrictEqual(r.waitlist, []);
});

test('마감 중에는 새 참가를 막지만 취소에 따른 승급은 일어난다', () => {
	const r = openRecruit({ capacity: 1 });
	store.join(r, user(1));
	store.join(r, user(2));
	store.setClosed(r, true);
	assert.strictEqual(store.join(r, user(3)).status, 'CLOSED');
	assert.deepStrictEqual(names(store.leave(r, 'u1').promoted), ['유저2']);
	store.setClosed(r, false);
	assert.strictEqual(store.join(r, user(3)).status, 'WAITLISTED');
});

test('같은 채널에 여러 모집을 동시에 열 수 있다', () => {
	const r = openRecruit();
	const again = store.open({ guildId: r.guildId, channelId: r.channelId, hostId: 'x', hostName: 'x', capacity: 10, memo: '' });
	assert.strictEqual(again.status, 'OPENED');
	assert.notStrictEqual(again.recruit.id, r.id);
	assert.strictEqual(store.find(r.channelId, r.id), r);
	assert.strictEqual(store.find(r.channelId, again.recruit.id), again.recruit);
});

test('종료하면 더 이상 찾을 수 없다', () => {
	const r = openRecruit();
	store.end(r);
	assert.strictEqual(store.find(r.channelId, r.id), null);
});

test('12시간이 지나면 만료되어 찾을 수 없다', () => {
	const now = 1_000_000;
	const r = openRecruit({ now });
	assert.strictEqual(store.find(r.channelId, r.id, now + store.EXPIRE_MS - 1), r);
	assert.strictEqual(store.find(r.channelId, r.id, now + store.EXPIRE_MS), null);
});

test('recruitId나 채널이 다르면(재시작 전 패널) 찾지 못한다', () => {
	const r = openRecruit();
	assert.strictEqual(store.find(r.channelId, r.id), r);
	assert.strictEqual(store.find(r.channelId, 'deadbeef'), null);
	assert.strictEqual(store.find('no-such-channel', r.id), null);
});

test('명단 복사 텍스트는 참가자만 한 줄에 한 명, 백틱은 치환한다', () => {
	const r = openRecruit({ capacity: 2 });
	store.join(r, { userId: 'a', name: '케이오' });
	store.join(r, { userId: 'b', name: 'abc`def' });
	store.join(r, { userId: 'c', name: '대기자' });
	assert.strictEqual(store.formatRosterText(r), "케이오\nabc'def");
});

test('참가자가 없으면 명단 복사 텍스트는 빈 문자열', () => {
	assert.strictEqual(store.formatRosterText(openRecruit()), '');
});

const kst = (iso) => Date.parse(`${iso}+09:00`);

const openIn = (guildId, now, channelId = `ch-${++seq}`) =>
	store.open({ guildId, channelId, hostId: 'h', hostName: 'h', capacity: 10, memo: '', now }).recruit;

test('하루는 KST 낮 12시에 바뀐다', () => {
	assert.strictEqual(store.roundDay(kst('2026-10-21T11:59:59')), store.roundDay(kst('2026-10-20T12:00:00')));
	assert.notStrictEqual(store.roundDay(kst('2026-10-21T12:00:00')), store.roundDay(kst('2026-10-21T11:59:59')));
	assert.strictEqual(store.roundDay(kst('2026-10-21T00:30:00')), store.roundDay(kst('2026-10-20T20:00:00')));
});

test('같은 서버에서 연 순서대로 1차·2차·3차, 자정을 넘겨도 이어진다', () => {
	const a = openIn('round-g1', kst('2026-10-20T20:00:00'));
	store.join(a, user(1));
	store.end(a);
	const b = openIn('round-g1', kst('2026-10-20T23:00:00'));
	store.join(b, user(1));
	store.end(b);
	const c = openIn('round-g1', kst('2026-10-21T01:00:00'));
	assert.deepStrictEqual([a.round, b.round, c.round], [1, 2, 3]);
});

test('낮 12시가 지나면 1차부터 다시 센다', () => {
	const a = openIn('round-g2', kst('2026-10-21T11:00:00'));
	store.join(a, user(1));
	store.end(a);
	const b = openIn('round-g2', kst('2026-10-21T12:00:00'));
	assert.deepStrictEqual([a.round, b.round], [1, 1]);
});

test('서버마다 따로 세고, 같은 서버의 다른 채널은 이어서 센다', () => {
	const now = kst('2026-10-20T21:00:00');
	const a = openIn('round-g3', now);
	const b = openIn('round-g3', now);
	const other = openIn('round-g4', now);
	assert.deepStrictEqual([a.round, b.round, other.round], [1, 2, 1]);
});

test('참가자 없이 종료하면 그 차수를 다음 모집이 다시 쓴다', () => {
	const now = kst('2026-10-20T21:00:00');
	const a = openIn('round-g5', now);
	store.join(a, user(1));
	store.end(a);
	const empty = openIn('round-g5', now);
	store.end(empty);
	const next = openIn('round-g5', now);
	assert.deepStrictEqual([a.round, empty.round, next.round], [1, 2, 2]);
});

test('빈 모집이 끝나기 전에 다른 채널이 다음 차수를 가져갔으면 돌려주지 않는다', () => {
	const now = kst('2026-10-20T21:00:00');
	const empty = openIn('round-g6', now);
	const other = openIn('round-g6', now);
	store.end(empty);
	const next = openIn('round-g6', now);
	assert.deepStrictEqual([empty.round, other.round, next.round], [1, 2, 3]);
});

test('참가자 없이 만료돼도 차수를 돌려준다', () => {
	const now = kst('2026-10-20T13:00:00');
	const a = openIn('round-g7', now);
	assert.strictEqual(store.find(a.channelId, a.id, now + store.EXPIRE_MS), null);
	const next = openIn('round-g7', now + store.EXPIRE_MS);
	assert.strictEqual(next.round, 1);
});

test('서버에서 동시에 5개까지 열리고 6번째는 GUILD_LIMIT', () => {
	const now = kst('2026-10-20T20:00:00');
	const opened = [1, 2, 3, 4, 5].map(() => openIn('limit-g1', now));
	const sixth = store.open({ guildId: 'limit-g1', channelId: 'limit-ch6', hostId: 'h', hostName: 'h', capacity: 10, memo: '', now });
	assert.strictEqual(sixth.status, 'GUILD_LIMIT');
	assert.deepStrictEqual(sixth.active, opened);
	assert.strictEqual(store.activeInGuild('limit-g1', now).length, 5);
});

test('하나를 종료하면 다시 열 수 있고, 다른 서버는 영향이 없다', () => {
	const now = kst('2026-10-20T20:00:00');
	const opened = [1, 2, 3, 4, 5].map(() => openIn('limit-g2', now));
	assert.strictEqual(openIn('limit-g3', now).round, 1);
	store.end(opened[0]);
	const again = store.open({ guildId: 'limit-g2', channelId: 'limit-ch7', hostId: 'h', hostName: 'h', capacity: 10, memo: '', now });
	assert.strictEqual(again.status, 'OPENED');
});

test('12시간이 지나 만료된 모집은 개수에 넣지 않는다', () => {
	const now = kst('2026-10-20T14:00:00');
	[1, 2, 3, 4, 5].forEach(() => openIn('limit-g4', now));
	const later = now + store.EXPIRE_MS;
	const next = store.open({ guildId: 'limit-g4', channelId: 'limit-ch8', hostId: 'h', hostName: 'h', capacity: 10, memo: '', now: later });
	assert.strictEqual(next.status, 'OPENED');
	assert.strictEqual(store.activeInGuild('limit-g4', later).length, 1);
});

test('한 채널에 5개를 열어도 서버 제한에 걸린다', () => {
	const now = kst('2026-10-20T20:00:00');
	const rounds = [1, 2, 3, 4, 5].map(() => openIn('limit-g5', now, 'same-ch').round);
	assert.deepStrictEqual(rounds, [1, 2, 3, 4, 5]);
	assert.strictEqual(
		store.open({ guildId: 'limit-g5', channelId: 'same-ch', hostId: 'h', hostName: 'h', capacity: 10, memo: '', now }).status,
		'GUILD_LIMIT',
	);
});

test('전체 멘션 텍스트는 참가자만 <@id> 형식으로 공백 구분', () => {
	const r = openRecruit({ capacity: 2 });
	store.join(r, { userId: '111', name: 'a' });
	store.join(r, { userId: '222', name: 'b' });
	store.join(r, { userId: '333', name: '대기자' });
	assert.strictEqual(store.formatMentionText(r), '<@111> <@222>');
});

test('빈 모집 둘이 작은 번호부터 끝나도 둘 다 반납된다', () => {
	const now = kst('2026-10-20T21:00:00');
	const first = openIn('release-g1', now);
	const second = openIn('release-g1', now);
	store.end(first);
	store.end(second);
	assert.strictEqual(openIn('release-g1', now).round, 1);
});

test('빈 모집 5개가 한꺼번에 만료돼도 1차부터 다시 연다', () => {
	const now = kst('2026-10-20T13:00:00');
	[1, 2, 3, 4, 5].forEach(() => openIn('release-g2', now));
	assert.strictEqual(openIn('release-g2', now + store.EXPIRE_MS).round, 1);
});

test('뒤 번호가 참가자와 함께 쓰이고 있으면 앞의 빈 번호는 접지 않는다', () => {
	const now = kst('2026-10-20T21:00:00');
	const empty = openIn('release-g3', now);
	const used = openIn('release-g3', now);
	store.join(used, user(1));
	store.end(empty);
	store.end(used);
	assert.strictEqual(openIn('release-g3', now).round, 3);
});

test('낮 12시 전에 연 빈 모집이 그 뒤에 끝나도 새 날의 차수는 건드리지 않는다', () => {
	const old = openIn('release-g4', kst('2026-10-21T11:00:00'));
	const today = openIn('release-g4', kst('2026-10-21T12:30:00'));
	store.join(today, user(1));
	store.end(old);
	assert.deepStrictEqual([old.round, today.round], [1, 1]);
	assert.strictEqual(openIn('release-g4', kst('2026-10-21T23:00:00')).round, 2);
});
