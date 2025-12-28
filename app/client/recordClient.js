const httpClient = require('../utils/networkUtils');
const prefix = '/matches';

/**
 * 전적 api call
 */

/**
 * @description !전적 조회에 필요한 모든 데이터 조회
 */
const get_all_record = async(riotName, riotNameTag, guildId) => {
  let url = `${prefix}/${guildId}/${riotName}/dashboard`;
  if(riotNameTag){
    url = `${url}?riotNameTag=${riotNameTag}`;
  }
  return httpClient.get(url);
}

/**
 * @description !최근 게임 조회
 */ 
const get_recent_record = async(riotName, riotNameTag, guildId) => {
  let url = `${prefix}/${guildId}/${riotName}/games`;
  if(riotNameTag){
    url = `${url}?riotNameTag=${riotNameTag}`;
  }
  return httpClient.get(url);
}

/**
 * @description !결과 Embed
 */
const get_result_record = async(gameId, guild_id) => {
  const url = `${prefix}/${guild_id}/games/${gameId}`;
  return httpClient.get(url);
}

module.exports = {
  get_all_record,
  get_recent_record,
  get_result_record,
}






