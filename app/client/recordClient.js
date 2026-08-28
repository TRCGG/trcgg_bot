const httpClient = require('../utils/networkUtils');
const prefix = '/matches';

// 닉네임 오타·미등록 멤버 조회는 정상 분기다. 에러 로그로 취급하지 않는다.
const MEMBER_MAY_BE_MISSING = { expectedStatuses: [404] };

/**
 * 전적 api call
 */

/**
 * @description !전적 조회에 필요한 모든 데이터 조회
 * @param {Object} [params] 추가 쿼리 — 대회 조회 시 { gameType: '2,3', competitionId }
 */
const get_all_record = async(riotName, riotNameTag, guildId, params = {}) => {
  const url = `${prefix}/${guildId}/${riotName}/dashboard`;
  const query = { ...(riotNameTag ? { riotNameTag } : {}), ...params };
  return httpClient.get(url, query, { ...MEMBER_MAY_BE_MISSING, guildId });
}

/**
 * @description !최근 게임 조회
 * @param {Object} [params] 추가 쿼리 — 대회 조회 시 { gameType: '2,3', competitionId, limit }
 */
const get_recent_record = async(riotName, riotNameTag, guildId, params = {}) => {
  const url = `${prefix}/${guildId}/${riotName}/games`;
  const query = { ...(riotNameTag ? { riotNameTag } : {}), ...params };
  return httpClient.get(url, query, { ...MEMBER_MAY_BE_MISSING, guildId });
}

/**
 * @description !결과 Embed
 */
const get_result_record = async(gameId, guild_id) => {
  const url = `${prefix}/${guild_id}/games/${gameId}`;
  return httpClient.get(url, {}, { guildId: guild_id });
}

module.exports = {
  get_all_record,
  get_recent_record,
  get_result_record,
}






