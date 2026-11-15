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
  // 백엔드 기본 limit은 10, 최대 100이다.
  return httpClient.get(url, { limit: 100 });
}

// PUT /guilds/:id는 decodeGuildId 미들웨어를 타지 않아 원본 id를 그대로 보낸다.
const update_guild_name = async (guildId, guildName) => {
  const url = `${prefix}/${guildId}`;
  return httpClient.put(url, { guildName }, { guildId });
};

module.exports = {
  get_guilds,
  update_guild_name,
};
