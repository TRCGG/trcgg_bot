const recordService = require("../services/recordService");
const commandUtils = require("../utils/commandUtilis");

/**
 * 전적 검색 명령어
 */
module.exports = [
  {
    name: "전적",
    run: async (client, msg, args) => {
      await commandUtils.execute(recordService, "get_all_record_embed", msg, args);
    },
  },
  {
    name: "최근전적",
    run: async (client, msg, args) => {
      await commandUtils.execute(recordService, "get_recent_record_embed", msg, args);
    },
  },
  {
    name: "결과",
    run: async (client, msg, args) => {
      await commandUtils.execute(recordService, "get_result_record_embed", msg, args);
    },
  },
  {
    name: "장인",
    run: async (client, msg, args) => {
      await commandUtils.execute(recordService, "get_master_record_embed", msg, args);
    },
  }
];
