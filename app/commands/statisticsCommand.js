const statsService = require("../services/statisticsService");
const stringUtils = require("../utils/stringUtils");
const res = require("../utils/responseHandler");

/**
 * 통계 검색 명령어
 */
module.exports = [
  {
    name: "장인",
    run: async (client, msg, args) => {
      try {
        const result = await statsService.get_master_of_champion_embed(
          msg,
          args
        );
        msg.reply(result);
      } catch (error) {
        res.error(msg, error);
      }
    },
  },
  {
    name: "클랜통계",
    run: async (client, msg, args) => {
      if (!stringUtils.checkAuth(msg)) return res.noAuth(msg);
      const year = args[0];
      const month = args[1];
      const guildId = stringUtils.encodeGuildId(msg.guild.id);

      if ((year && !month) || (!year && month)) {
        return msg.reply(
          "사용법이 올바르지 않습니다.\n" +
            "- 전체 조회: `!클랜통계`\n" +
            "- 특정 월 조회: `!클랜통계 2025 12`"
        );
      }

      if (year && month) {
        const m = Number(month);
        const y = Number(year);

        if (isNaN(y) || isNaN(m) || m < 1 || m > 12) {
          return msg.reply(
            "날짜 형식이 올바르지 않습니다.\n(월은 1~12 사이의 숫자여야 합니다)"
          );
        }
      }

      const processingMsg = await msg.reply(
        "데이터를 수집하고 엑셀을 생성 중입니다... ⏳"
      );

      try {
        await statsService.send_excel_file(msg, year, month, guildId);
        await processingMsg.delete().catch(() => {});
      } catch (error) {
        console.error(error);
        msg.reply("데이터를 가져오는 중 오류가 발생했습니다.");
      }
    },
  },
];
