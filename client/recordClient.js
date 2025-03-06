const httpClient = require('../utils/networkUtils');
const prefix = '/record';

/**
 * 전적 api call
 */

/**
 * @param {String} riot_name 
 * @param {String} riot_name_tag 
 * @param {String} guild_id 
 * @description !전적 조회에 필요한 모든 데이터 조회
 */
const get_all_record = async(riot_name, riot_name_tag, guild_id) => {
  let url = `${prefix}/all/embed/${riot_name}/${guild_id}`;
  if(riot_name_tag){
    url = `${url}?riot_name_tag=${riot_name_tag}`;
  }
  return httpClient.get(url);
}

/**
 * @param {String} riot_name
 * @param {String} riot_name_tag not required
 * @param {String} guild_id
 * @description !최근 게임 조회
 */ 
const get_recent_record = async(riot_name, riot_name_tag, guild_id) => {
  let url = `${prefix}/recent/embed/${riot_name}/${guild_id}`;
  if(riot_name_tag){
    url = `${url}?riot_name_tag=${riot_name_tag}`;
  }
  return httpClient.get(url);
}

/**
 * @param champ_name
 * @param guild_id
 * @description !장인 Embed
 * @returns
 */
const get_master_record = async(champ_name, guild_id) => {
  const url = `${prefix}/master/embed/${champ_name}/${guild_id}`;
  return httpClient.get(url);
}

/**
 * @param year
 * @param month
 * @param guild_id
 * @description !통계 챔프 Embed
 * @returns
 */
const get_champstat_record = async(year, month, guild_id) => {
  const url = `${prefix}/champstat/embed/${year}/${month}/${guild_id}`;
  return httpClient.get(url);
}

/**
 * @param year
 * @param month
 * @param guild_id
 * @description !통계 게임 Embed
 * @returns
 */
const get_gamestat_record = async(year, month, guild_id) => {
  const url = `${prefix}/gamestat/embed/${year}/${month}/${guild_id}`;
  return httpClient.get(url);
}

/**
 * @param position
 * @param guild_id
 * @description !라인 {탑/정글/미드/원딜/서폿} Embed
 * @returns
 */
const get_linestat_record = async(position, guild_id) => {
  const url = `${prefix}/linestat/embed/${position}/${guild_id}`;
  return httpClient.get(url);
}

/**
 * @param game_id
 * @param guild_id
 * @description !결과 Embed
 * @returns
 */
const get_result_record = async(game_id, guild_id) => {
  const url = `${prefix}/result/embed/${game_id}/${guild_id}`;
  return httpClient.get(url);
}

/**
 * @param year
 * @param month
 * @param guild_id
 * @description !클랜통계 Embed
 * @returns
 */
const get_clanstat_record = async(year, month, guild_id) => {
  const url = `${prefix}/clanstat/embed/${year}/${month}/${guild_id}`;
  return httpClient.get(url);
}

module.exports = {
  get_all_record,
  get_recent_record,
  get_master_record,
  get_champstat_record,
  get_gamestat_record,
  get_linestat_record,
  get_result_record,
  get_clanstat_record,
}






