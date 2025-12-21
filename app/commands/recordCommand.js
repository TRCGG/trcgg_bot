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
        res.error(msg, error);
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
        res.error(msg, error);
      }
    },
  },
];
