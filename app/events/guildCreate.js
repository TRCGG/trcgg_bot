const { Events } = require("discord.js");
const guildService = require("../services/guildService");

/**
 * 디코 서버 초대 이벤트
 */
module.exports = {
  name: Events.GuildCreate,
  once: false,
  async execute(client, guild) {
    await guildService.on_guild_join(client, guild);
  },
};
