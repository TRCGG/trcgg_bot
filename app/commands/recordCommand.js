const recordService = require("../services/recordService");
const res = require('../utils/responseHandler');

/**
 * 전적 검색 명령어
 */
module.exports = [
  {
    name: "전적",
    run: async (client, msg, args) => {
      try {
        const result = await recordService.get_all_record_embed(msg, args);
        msg.reply(result);
      } catch (error) {
        if (error?.message && error.message.includes("검색 결과가 없습니다")) {
          msg.reply(error.message);
        } else {
          res.error(msg, error);
        }
      }
    },
  },
  {
    name: "결과",
    run: async (client, msg, args) => {
      try {
        const result = await recordService.get_result_record_embed(msg, args);
        msg.reply(result);
      } catch (error) {
        if(error?.message === 'Game not found'){
          const text = args.join(" "); 
          msg.reply(`**${text}** 검색 결과가 없습니다.`);
        } else {
          res.error(msg, error);
        }
      }
    },
  },
];
