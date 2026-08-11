const stringUtils = require("../utils/stringUtils");
const guildService = require("../services/guildService");
const ADMIN_ID = process.env.ADMIN_ID;
const res = require('../utils/responseHandler');
const { safeReply } = require('../utils/discordUtils');


/**
 * @description 길드 관련 명령어
 */
module.exports = [
  {
    name: "길드목록",
    description: "DB저장되어있는 길드 목록",
    run: async (client, msg, args) => {
      if (msg.author.id !== ADMIN_ID) return res.noAuth(msg);
      try {
        const result = await guildService.get_guilds_list();
        await safeReply(msg, result);
      } catch (error) {
        res.error(msg, error);
      }
    }
  },
  {
    name: "디스코드길드목록",
    description: "내전봇이 디스코드에 있는 길드 목록",
    run: async (client, msg, args) => {
      if (msg.author.id !== ADMIN_ID) return res.noAuth(msg);
      try {
        const result = await guildService.show_guild_list(client);
        await safeReply(msg, result);
      } catch (error) {
        res.error(msg, error);
      }
    },
  },
  {
    name:"길드떠나기",
    description: "봇이 길드 서버를 떠남",
    run: async (client, msg, args) => {
      if (msg.author.id !== ADMIN_ID) return res.noAuth(msg);
      try {
        // leave_discord_guild가 성공·실패 응답을 직접 보낸다. 여기서 또 답장하면
        // 반환값이 undefined라 빈 응답을 시도하게 된다.
        await guildService.leave_discord_guild(client, msg, args);
      } catch (error) {
        res.error(msg, error);
      }
    },
  },
  {
    name: "클랜원목록",
    description: "액셀파일로 길드원 목록을 보여줍니다.",
    run: async (client, msg, args) => {
      if (!stringUtils.checkAuth(msg)) return res.noAuth(msg);
      try {
        const result = await guildService.show_guild_member_list(client, msg, args);
      } catch (error) {
        res.error(msg, error);
      }
    },
  }
];
