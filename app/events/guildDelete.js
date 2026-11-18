const { Events } = require("discord.js");
const guildService = require("../services/guildService");

/**
 * 디코 서버 퇴장(강퇴·나가기) 이벤트
 */
module.exports = {
  name: Events.GuildDelete,
  once: false,
  async execute(client, guild) {
    await guildService.on_guild_leave(client, guild);
  },
};
