const httpClient = require('../utils/networkUtils');
const prefix = '/competitions';

/**
 * 대회 api (TRC-283). guildId는 base64 인코딩된 값.
 * 개설/종료/삭제는 actorMemberId(명령 사용자 Discord id)를 보내 백엔드 감사 로그에 남긴다.
 */

const post_competition = async (guildId, name, actorMemberId) => {
	const url = `${prefix}/${guildId}`;
	// 409: OPEN 대회가 이미 있거나 같은 이름이 있음 — 안내 메시지로 처리
	return httpClient.post(url, { name, actorMemberId }, { guildId, expectedStatuses: [409] });
};

const get_competitions = async (guildId, params = {}) => {
	const url = `${prefix}/${guildId}`;
	return httpClient.get(url, params, { guildId });
};

/**
 * @description 대회명 해석. name 생략 시 OPEN → 최근 종료.
 * @returns {Promise<{match: Object|null, candidates: Array}>}
 */
const resolve_competition = async (guildId, name) => {
	const url = `${prefix}/${guildId}/resolve`;
	return httpClient.get(url, name ? { name } : {}, { guildId });
};

const patch_close = async (guildId, competitionId, actorMemberId) => {
	const url = `${prefix}/${guildId}/${competitionId}/close`;
	return httpClient.patch(url, { actorMemberId }, { guildId, expectedStatuses: [404] });
};

const delete_competition = async (guildId, competitionId, actorMemberId) => {
	const url = `${prefix}/${guildId}/${competitionId}`;
	// 409: 활성 경기가 남아 있음
	return httpClient.delete(url, { actorMemberId }, { guildId, expectedStatuses: [404, 409] });
};

module.exports = {
	post_competition,
	get_competitions,
	resolve_competition,
	patch_close,
	delete_competition,
};
