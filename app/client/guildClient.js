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

// 삭제된 길드는 404로 숨겨진다.
const get_guild = async (guildId) => {
  try {
    return await httpClient.get(`${prefix}/${guildId}`, {}, { guildId, expectedStatuses: [404] });
  } catch (error) {
    if (error?.status === 404) return null;
    throw error;
  }
};

// 이미 있는 길드면 생성하지 않고 기존 행을 돌려준다(삭제된 길드도 되살리지 않는다).
const create_guild = async (guildId, guildName) => {
  return httpClient.post(prefix, { guildId, guildName }, { guildId });
};

module.exports = {
  get_guilds,
  get_guild,
  create_guild,
  update_guild_name,
};
