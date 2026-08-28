const competitionClient = require('../client/competitionClient');
const stringUtils = require('../utils/stringUtils');
const { BotError } = require('../utils/errors');

/**
 * 대회 관리 (TRC-283)
 * 길드당 OPEN 대회는 하나. 종료 뒤엔 리플을 그 대회에 올릴 수 없다.
 */

const normalizeName = (args) => args.join(' ').trim().replace(/\s+/g, ' ');

const STATUS_LABEL = { OPEN: '진행중', CLOSED: '종료' };

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
};
