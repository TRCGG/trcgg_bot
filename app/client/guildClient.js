const httpClient = require("../utils/networkUtils");
const prefix = "/guilds";

/**
  guild api call
 */

/**
 * @desc DB에 저장되어있는 길드 목록
 */
const get_guilds = async () => {
  const url = `${prefix}`;
  return httpClient.get(url);
}

/**
 * @param {*} guild_id 
 * @description guild 삭제
 * @returns 
 */
const delete_guild = async (guildId) => {
  const url = `${prefix}/${guildId}`;
  return httpClient.delete(url);
};

module.exports = {
  get_guilds,
  delete_guild,
};
