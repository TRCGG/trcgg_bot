const recordService = require("../services/recordService");
const commandUtils = require("../utils/commandUtilis");
const stringUtils = require('../utils/stringUtils');

/**
 * 통계 검색 명령어
 */
module.exports = [
  {
    name: "통계",
    run: async (client, msg, args) => {
      let type=undefined, date = undefined;

      if (args.length === 2) {
        [type, date] = args;
      } else if (args.length === 1) {
        type = args[0];
      } else {
        msg.reply("잘못된 형식");
      }

      if(type === "게임"){
        await commandUtils.execute(recordService, "get_gamestat_record_embed", msg, date);
      }else if(type ==="챔프"){
        await commandUtils.execute(recordService, "get_champstat_record_embed", msg, date);
      }else {
        msg.reply("명령어는 !통계 (게임 or 챔프)");
      }
    },
  },
  {
    name: "라인",
    run: async (client, msg, args) => {
    	await commandUtils.execute(recordService, "get_linestat_record_embed", msg, args);
    },
  },
  {
    name: "클랜통계",
    run: async (client, msg, args) => {
			// 권한체크
      if (!stringUtils.checkAuth(msg)) {
        msg.reply("권한 없음");
        return;
      }
      await recordService.get_clanstat_record_embed(msg, args)
        .then((result) => {
        })
        .catch((err) => {
          console.log(err);
          msg.reply(err.message);
        });
    },
  },
  
];
