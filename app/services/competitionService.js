const competitionClient = require('../client/competitionClient');
const recordClient = require('../client/recordClient');
const statisticsClient = require('../client/statisticsClient');
const stringUtils = require('../utils/stringUtils');
const { BotError } = require('../utils/errors');

/**
 * 대회 관리·조회 (TRC-283)
 * 길드당 OPEN 대회는 하나. 종료 뒤엔 리플을 그 대회에 올릴 수 없다.
 */

const normalizeName = (args) => args.join(' ').trim().replace(/\s+/g, ' ');

const STATUS_LABEL = { OPEN: '진행중', CLOSED: '종료' };

// 대회 조회는 스크림+본경기 통합. 분리는 프론트가 API 필터로 한다.
const COMPETITION_SCOPE = { gameType: '2,3' };
const RECENT_GAMES_LIMIT = 100;

/**
 * `!전적대회 닉네임 / 대회명` — 닉네임과 대회명 둘 다 공백을 가질 수 있어 `/`로 가른다.
 * `/`가 없으면 전부 닉네임이고 대회는 OPEN(없으면 최근 종료)이다.
 */
const parseRecordArgs = (args) => {
  const separator = args.indexOf('/');
  if (separator === -1) return { nickArgs: args, competitionName: '' };
  return {
    nickArgs: args.slice(0, separator),
    competitionName: normalizeName(args.slice(separator + 1)),
  };
};

/**
 * 대회명 → 대회. 후보가 여럿이면 고르라는 메시지로, 없으면 안내로 끝낸다.
 * @returns {Promise<Object>} match
 */
const resolveCompetitionOrThrow = async (guildId, competitionName) => {
	const { match, candidates } = await competitionClient.resolve_competition(guildId, competitionName);
	if (match) return match;
	if (candidates && candidates.length > 0) {
		const list = candidates.map((c) => `• ${c.name} (${STATUS_LABEL[c.status] || c.status})`).join('\n');
		throw new Error(`대회가 여러 개 있습니다. 이름을 더 정확히 입력해주세요:\n${list}`);
	}
	throw new Error(
		competitionName ? `대회를 찾을 수 없습니다: ${competitionName}` : '등록된 대회가 없습니다.',
	);
};

const winRateText = (win, total) => (total > 0 ? ((win / total) * 100).toFixed(1) : '0.0');

/**
 * @description !전적대회 embed — 한 대회의 스크림 + ★본경기 개인 전적
 */
const get_competition_record_embed = async (msg, args) => {
	const { nickArgs, competitionName } = parseRecordArgs(args);
	const [riotName, riotNameTag] = stringUtils.getMemberNick(msg, nickArgs);
	if (!riotName || riotName.length < 2) return '닉네임은 두 글자 이상 입력해주세요';

	const guildId = stringUtils.encodeGuildId(msg.guild.id);
	const competition = await resolveCompetitionOrThrow(guildId, competitionName);
	const scope = { ...COMPETITION_SCOPE, competitionId: competition.id };

	const [dashboard, recent] = await Promise.allSettled([
		recordClient.get_all_record(riotName, riotNameTag, guildId, scope),
		recordClient.get_recent_record(riotName, riotNameTag, guildId, { ...scope, limit: RECENT_GAMES_LIMIT }),
	]);
	const memberMissing = (r) => r.reason?.status === 404 && r.reason?.message === 'guild member not found';
	const failures = [dashboard, recent].filter((r) => r.status === 'rejected');
	const realFailure = failures.find((r) => !memberMissing(r));
	if (realFailure) throw realFailure.reason;
	if (failures.length > 0) {
		throw new Error(`**${riotName}${riotNameTag ? `#${riotNameTag}` : ''}** 검색 결과가 없습니다.`);
	}

	const result = dashboard.value;
	if (Array.isArray(result)) {
		// 동명이인 — 태그까지 입력하게 안내
		const names = result.map((a) => `${a.riotName}#${a.riotNameTag}`).join('\n');
		return stringUtils.createEmbed({ title: '검색결과', description: names });
	}

	const { member, summary, lines, mostPicks } = result;
	const games = recent.value || [];

	// 유형별 승패는 경기 목록에서 센다 (dashboard는 통합값만 준다)
	const byType = { '2': { win: 0, lose: 0 }, '3': { win: 0, lose: 0 } };
	for (const g of games) {
		const bucket = byType[g.gameType];
		if (!bucket) continue;
		if (g.gameResult === '승') bucket.win += 1;
		else bucket.lose += 1;
	}
	const scrim = byType['2'];
	const main = byType['3'];

	const total = `**합계: ${summary.totalCount}전 ${summary.win}승 ${summary.lose}패 (${summary.winRate}%) KDA ${summary.kda}**`;
	const scrimLine = `스크림: ${scrim.win + scrim.lose}전 ${scrim.win}승 ${scrim.lose}패 (${winRateText(scrim.win, scrim.win + scrim.lose)}%)`;
	const mainLine = `★본경기: ${main.win + main.lose}전 ${main.win}승 ${main.lose}패 (${winRateText(main.win, main.win + main.lose)}%)`;

	const lineDesc = lines
		.map((l) => `${l.position}: ${l.win}승 ${l.lose}패 ${l.winRate}% (KDA ${l.kda})`)
		.join('\n');

	const recentValue = games
		.slice(0, 5)
		.map((g) => {
			const icon = g.gameResult === '승' ? ':blue_circle:' : ':red_circle:';
			const star = g.gameType === '3' ? '★' : '';
			return `${icon} ${star}${g.champName} ${g.kill}/${g.death}/${g.assist} (${g.gameId})`;
		})
		.join('\n');

	const mostPickValue = mostPicks
		.slice(0, 5)
		.map((p) => `${p.champName}: ${p.totalCount}판 ${p.winRate}% (${p.kda})`)
		.join('\n');

	const status = competition.status === 'OPEN' ? '진행중' : '종료';
	return stringUtils.createEmbed({
		title: `${member.riotName}#${member.riotNameTag} — ${competition.name}`,
		description: `${total}\n${scrimLine}\n${mainLine}\n\n${lineDesc || '라인 기록 없음'}`,
		color: 0xffa500,
		fields: [
			{ name: `최근 ${Math.min(games.length, 5)}경기 (★=본경기)`, value: recentValue || '기록 없음', inline: false },
			{ name: 'Most Pick :trophy:', value: mostPickValue || '기록 없음', inline: false },
		],
		footer: { text: `${competition.name} · ${status} · 스크림 ${competition.scrimCount} / 본경기 ${competition.mainCount}` },
	});
};

const formatNumber = (value, digits = 0) => {
	const n = Number(value);
	return Number.isNaN(n) ? '0' : n.toFixed(digits).replace(/\.0+$/, '');
};

const rankLines = (rows, render) =>
	rows.length === 0 ? '데이터 없음' : rows.map((r, i) => `${i + 1}. ${render(r)}`).join('\n');

/**
 * @description !통계대회 embed — 대회 개인 랭킹 (승률·KDA·판수) + 많이 나온 챔피언
 */
const get_competition_stats_embed = async (msg, args) => {
	const competitionName = normalizeName(args);
	const guildId = stringUtils.encodeGuildId(msg.guild.id);
	const competition = await resolveCompetitionOrThrow(guildId, competitionName);

	const [users, champions] = await Promise.all([
		statisticsClient.get_competition_user_data(guildId, competition.id),
		statisticsClient.get_competition_champion_data(guildId, competition.id),
	]);

	if (!Array.isArray(users) || users.length === 0) {
		return `${competition.name}에 등록된 경기가 없습니다.`;
	}

	// 대회는 판수가 적다 — 최다 판수의 절반 이상만 승률 랭킹에 올려 1판 100%가 1위 되는 걸 막는다
	const maxCount = Math.max(...users.map((u) => u.totalCount));
	const minGames = Math.max(1, Math.ceil(maxCount / 2));

	const byWinRate = users
		.filter((u) => u.totalCount >= minGames)
		.sort((a, b) => parseFloat(b.winRate) - parseFloat(a.winRate) || b.totalCount - a.totalCount)
		.slice(0, 10);
	const byKda = [...users]
		.filter((u) => u.totalCount >= minGames)
		.sort((a, b) => parseFloat(b.kda) - parseFloat(a.kda) || b.totalCount - a.totalCount)
		.slice(0, 10);
	const byCount = [...users]
		.sort((a, b) => b.totalCount - a.totalCount || parseFloat(b.winRate) - parseFloat(a.winRate))
		.slice(0, 10);
	const topChampions = (Array.isArray(champions) ? champions : [])
		.sort((a, b) => b.totalCount - a.totalCount || parseFloat(b.winRate) - parseFloat(a.winRate))
		.slice(0, 5);

	const userLine = (u) =>
		`${u.riotName} (${u.totalCount}판 / ${formatNumber(u.winRate)}% / KDA ${formatNumber(u.kda, 2)})`;

	const status = competition.status === 'OPEN' ? '진행중' : '종료';
	return stringUtils.createEmbed({
		title: `${competition.name} 통계`,
		description: `스크림 ${competition.scrimCount} · ★본경기 ${competition.mainCount} — 참가 ${users.length}명 (${status})`,
		color: 0xffd700,
		fields: [
			{ name: `승률 Top 10 (${minGames}판 이상)`, value: rankLines(byWinRate, userLine), inline: false },
			{ name: `KDA Top 10 (${minGames}판 이상)`, value: rankLines(byKda, userLine), inline: false },
			{ name: '최다 판수 Top 10', value: rankLines(byCount, userLine), inline: false },
			{
				name: '많이 나온 챔피언 Top 5',
				value: rankLines(topChampions, (c) => `${c.champName} (${c.totalCount}판 / ${formatNumber(c.winRate)}%)`),
				inline: false,
			},
		],
	});
};

const open_competition = async (msg, args) => {
	const name = normalizeName(args);
	if (!name) throw new Error('대회 이름을 입력해주세요. (ex: !대회개설 멸망전 1회)');
	if (name.length > 64) throw new Error('대회 이름은 64자 이하로 입력해주세요.');

	const guildId = stringUtils.encodeGuildId(msg.guild.id);
	try {
		return await competitionClient.post_competition(guildId, name, msg.author.id);
	} catch (error) {
		if (error instanceof BotError && error.status === 409) {
			if (error.type === 'competition-open-exists') {
				throw new Error('이미 진행 중인 대회가 있습니다. `!대회종료` 후 개설해주세요.');
			}
			throw new Error(`같은 이름의 대회가 이미 있습니다: ${name}`);
		}
		throw error;
	}
};

/** OPEN 대회를 종료한다. 이름은 받지 않는다 — OPEN은 하나뿐이다. */
const close_competition = async (msg) => {
	const guildId = stringUtils.encodeGuildId(msg.guild.id);
	const { match } = await competitionClient.resolve_competition(guildId);
	if (!match || match.status !== 'OPEN') {
		throw new Error('진행 중인 대회가 없습니다.');
	}
	return competitionClient.patch_close(guildId, match.id, msg.author.id);
};

/** 삭제는 정확한 이름만. 활성 경기가 있으면 백엔드가 409로 막는다. */
const delete_competition = async (msg, args) => {
	const name = normalizeName(args);
	if (!name) throw new Error('삭제할 대회 이름을 입력해주세요. (ex: !대회삭제 멸망전 1회)');

	const guildId = stringUtils.encodeGuildId(msg.guild.id);
	const { match } = await competitionClient.resolve_competition(guildId, name);
	// resolve는 부분일치 1건도 match로 주므로 이름을 다시 대조한다
	if (!match || match.name !== name) {
		throw new Error(`대회를 찾을 수 없습니다: ${name} (이름을 정확히 입력해주세요)`);
	}

	try {
		return await competitionClient.delete_competition(guildId, match.id, msg.author.id);
	} catch (error) {
		if (error instanceof BotError && error.status === 409) {
			throw new Error(
				`경기가 등록된 대회는 삭제할 수 없습니다: ${match.name} ` +
					`(스크림 ${match.scrimCount}·본경기 ${match.mainCount})`,
			);
		}
		throw error;
	}
};

const get_list_embed = async (msg) => {
	const guildId = stringUtils.encodeGuildId(msg.guild.id);
	const competitions = await competitionClient.get_competitions(guildId);

	if (!competitions || competitions.length === 0) {
		return '등록된 대회가 없습니다. `!대회개설 [이름]`으로 시작하세요.';
	}

	const lines = competitions.map((c) => {
		const status = c.status === 'OPEN' ? '🟢 진행중' : `⚪ ${STATUS_LABEL[c.status] || c.status}`;
		return `${status} **${c.name}** — 스크림 ${c.scrimCount} · ★본경기 ${c.mainCount}`;
	});

	return stringUtils.createEmbed({
		title: '대회 목록',
		description: lines.join('\n'),
		color: 0x5865f2,
	});
};

module.exports = {
	open_competition,
	close_competition,
	delete_competition,
	get_list_embed,
	get_competition_record_embed,
	get_competition_stats_embed,
	parseRecordArgs,
};
