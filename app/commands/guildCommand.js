const commandUtils = require("../utils/commandUtilis");
const guildService = require("../services/guildService");
const selectBoxUtils = require("../utils/selectBoxUtils");
const ADMIN_ID = process.env.ADMIN_ID;


/**
 * @description 길드 관련 명령어
 */
module.exports = [
  {
    name: "길드목록",
  description: "길드 관련 명령어",
    run: async (client, msg, args) => {
      if(!msg.author.id === ADMIN_ID) {
        msg.reply("권한 없음");
        return;
      }
      await commandUtils.executeWithClient(guildService, "show_and_insert_guild_list", client, msg, args);
    },
  },
  {
    name:"길드떠나기",
    description: "봇이 길드 서버를 떠남",
    run: async (client, msg, args) => {
      if(!msg.author.id === ADMIN_ID) {
        msg.reply("권한 없음");
        return;
      }
      await commandUtils.exec(guildService, "delete_guild", client, msg, args);
    },
  },
  {
    name:"lan",
    description: "길드 언어 설정",
    run: async (client, msg, args) => {
      await commandUtils.exec(selectBoxUtils, "lang_box_message", client, msg, args);
    },
  }
];
