const httpClient = require('../utils/networkUtils');
const prefix = '/tournament';

/**
 * 토너먼트코드 api (TRC-226)
 * networkUtils(httpClient) 재사용 — BASE_URL + x-discord-bot 헤더는 httpClient가 처리.
 */

/**
 * @description 코드 선발급 요청 (POST /tournament/codes)
 * @param {Object} data
 * @param {String} data.guildId  디스코드 길드 id
 * @param {String} data.channelId 코드를 게시할 채널 id (metadata에 저장됨)
 * @param {Number} data.count    선발급 개수
 * @param {String} data.gameType 경기 유형 (1=일반내전/2=스크림/3=대회) — 적재 시 custom_match.game_type으로 전파
 * @returns {Promise<{codes: Array<{code:String, guildId:String, channelId:String, status:String, issuedDate:String}>}>}
 */
const post_codes = async ({ guildId, channelId, count, gameType }) => {
	const url = `${prefix}/codes`;
	return httpClient.post(url, { guildId, channelId, count, gameType });
};

/**
 * @description 미사용 다음 코드 조회 (GET /tournament/next-code)
 * @param {String} guildId 디스코드 길드 id
 * @returns {Promise<{code:String, guildId:String, channelId:String, status:String, issuedDate:String}>}
 * @throws {BotError} 코드가 없으면 백엔드가 404 → httpClient가 BotError(404)로 throw
 */
const get_next_code = async (guildId) => {
	const url = `${prefix}/next-code`;
	return httpClient.get(url, { guildId });
};

module.exports = {
	post_codes,
	get_next_code,
};
