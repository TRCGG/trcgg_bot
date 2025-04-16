const httpClient = require("../utils/networkUtils");
const prefix = "/guild";

/**
  guild api call
 */

/**
 * @param {*} data
 * @description guild 추가
 * @returns
 */
const post_guild = async (data) => {
  const url = `${prefix}`;
  return httpClient.post(url, data);
};

/**
 * @param {*} data 
 * @description guild 언어 설정
 * @returns 
 */
const put_guild_lang = async (data) => {
  const url = `${prefix}/lang`;
  return httpClient.put(url, data);
}

/**
 * @param {*} guild_id 
 * @description guild 삭제
 * @returns 
 */
const delete_guild = async (guild_id) => {
  const url = `${prefix}/${guild_id}`;
  return httpClient.delete(url);
};

module.exports = {
  post_guild,
  put_guild_lang,
  delete_guild,
};
