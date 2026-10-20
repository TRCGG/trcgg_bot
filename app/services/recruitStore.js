const crypto = require('node:crypto');

/**
 * 내전 모집 상태 — 봇 메모리에만 둔다 (재시작 시 유실 수용).
 *
 * 모든 변경 함수는 동기다. 버튼 핸들러가 await 전에 상태를 확정하므로
 * 동시 클릭이 와도 정원을 넘겨 받지 않는다. 여기에 await를 넣으면 이 보장이 깨진다.
 */

const EXPIRE_MS = 12 * 60 * 60 * 1000;
const MAX_PER_GUILD = 5;

// 내전은 자정을 넘겨 이어지므로 하루를 KST 낮 12시에 끊는다. KST(+9h)에서 12시간을 빼면 UTC-3h.
const ROUND_DAY_OFFSET_MS = 3 * 60 * 60 * 1000;

const recruits = new Map();
const rounds = new Map(); // guildId → { day, last, released }

const roundDay = (now) => new Date(now - ROUND_DAY_OFFSET_MS).toISOString().slice(0, 10);

const takeRound = (guildId, now) => {
	const day = roundDay(now);
	let counter = rounds.get(guildId);
	if (!counter || counter.day !== day) {
		counter = { day, last: 0, released: new Set() };
		rounds.set(guildId, counter);
	}
	counter.last += 1;
	return counter.last;
};

// 참가자 없이 끝난 모집은 잘못 연 것으로 보고 차수를 돌려준다. 번호는 끝에서부터만 접는다 —
// 그 뒤 번호를 다른 모집이 쓰고 있으면 중간 번호를 돌려줄 수 없다. 빈 모집이 여러 개 어떤 순서로
// 끝나도 모두 접히도록 반납된 번호를 모아둔다.
const releaseRoundIfEmpty = (recruit) => {
	if (recruit.participants.length > 0) return;
	const counter = rounds.get(recruit.guildId);
	if (!counter || counter.day !== roundDay(recruit.createdAt)) return;
	counter.released.add(recruit.round);
	while (counter.released.has(counter.last)) {
		counter.released.delete(counter.last);
		counter.last -= 1;
	}
};

const end = (recruit) => {
	if (recruits.get(recruit.id) !== recruit) return;
	recruits.delete(recruit.id);
	releaseRoundIfEmpty(recruit);
};

const isExpired = (recruit, now = Date.now()) => now - recruit.createdAt >= EXPIRE_MS;

const isActive = (recruit, now) => {
	if (!isExpired(recruit, now)) return true;
	end(recruit);
	return false;
};

// 재시작 전 패널 버튼은 recruitId가 메모리에 없어 null이 된다.
const find = (channelId, recruitId, now = Date.now()) => {
	const recruit = recruits.get(recruitId);
	return recruit && recruit.channelId === channelId && isActive(recruit, now) ? recruit : null;
};

const activeInGuild = (guildId, now = Date.now()) =>
	[...recruits.values()].filter((r) => r.guildId === guildId && isActive(r, now));

const open = ({ guildId, channelId, hostId, hostName, capacity, memo, now = Date.now() }) => {
	const active = activeInGuild(guildId, now);
	if (active.length >= MAX_PER_GUILD) return { status: 'GUILD_LIMIT', active };

	const recruit = {
		id: crypto.randomBytes(4).toString('hex'),
		guildId,
		channelId,
		round: takeRound(guildId, now),
		messageId: null,
		hostId,
		hostName,
		capacity,
		memo,
		participants: [],
		waitlist: [],
		closed: false,
		createdAt: now,
	};
	recruits.set(recruit.id, recruit);
	return { status: 'OPENED', recruit };
};

const promote = (recruit) => {
	const promoted = [];
	while (recruit.participants.length < recruit.capacity && recruit.waitlist.length > 0) {
		const member = recruit.waitlist.shift();
		recruit.participants.push(member);
		promoted.push(member);
	}
	return promoted;
};

const isIn = (list, userId) => list.some((m) => m.userId === userId);

const join = (recruit, { userId, name }) => {
	if (isIn(recruit.participants, userId) || isIn(recruit.waitlist, userId)) {
		return { status: 'ALREADY_IN' };
	}
	if (recruit.closed) return { status: 'CLOSED' };

	if (recruit.participants.length < recruit.capacity) {
		recruit.participants.push({ userId, name });
		return { status: 'JOINED', position: recruit.participants.length };
	}
	recruit.waitlist.push({ userId, name });
	return { status: 'WAITLISTED', position: recruit.waitlist.length };
};

const removeFrom = (list, userIds) => {
	const removed = [];
	for (let i = list.length - 1; i >= 0; i--) {
		if (userIds.has(list[i].userId)) removed.unshift(...list.splice(i, 1));
	}
	return removed;
};

const kick = (recruit, userIds) => {
	const ids = new Set(userIds);
	const removed = [
		...removeFrom(recruit.participants, ids),
		...removeFrom(recruit.waitlist, ids),
	];
	return { removed, promoted: promote(recruit) };
};

const leave = (recruit, userId) => {
	const { removed, promoted } = kick(recruit, [userId]);
	if (removed.length === 0) return { status: 'NOT_IN', promoted };
	return { status: 'LEFT', promoted };
};

const setClosed = (recruit, closed) => {
	recruit.closed = closed;
};

// 코드 블록 안에 백틱이 있으면 블록이 일찍 닫혀 이후 줄이 깨진다.
const formatRosterText = (recruit) =>
	recruit.participants.map((m) => m.name.replace(/`/g, "'")).join('\n');

// `@닉네임` 텍스트는 붙여넣어도 알림이 가지 않는다. 디스코드는 `<@id>` 형식만 멘션으로 바꾼다.
const formatMentionText = (recruit) => recruit.participants.map((m) => `<@${m.userId}>`).join(' ');

module.exports = {
	EXPIRE_MS,
	MAX_PER_GUILD,
	roundDay,
	activeInGuild,
	isExpired,
	find,
	open,
	end,
	join,
	leave,
	kick,
	setClosed,
	formatRosterText,
	formatMentionText,
};
