const statsService = require("../services/statisticsService");
const stringUtils = require("../utils/stringUtils");
const res = require("../utils/responseHandler");
const { safeReply, canSend } = require("../utils/discordUtils");

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
        await safeReply(msg, result, 'cmd:장인');
      } catch (error) {
        res.error(msg, error);
      }
    },
  },
  {
    name: "클랜통계",
    run: async (client, msg, args) => {
      if (!stringUtils.checkAuth(msg)) return res.noAuth(msg);
      const seasonArg = args[0];
      const month = args[1];
      const guildId = stringUtils.encodeGuildId(msg.guild.id);

      if (args.length > 2 || (!seasonArg && month)) {
        return safeReply(msg,
          "사용법이 올바르지 않습니다.\n" +
            "- 기본 시즌 전체 조회: `!클랜통계`\n" +
            "- 특정 시즌 전체 조회: `!클랜통계 2025`\n" +
            "- 특정 월 조회: `!클랜통계 2025 12`",
          'cmd:클랜통계:usage'
        );
      }

      if (seasonArg) {
        const targetSeason = Number(seasonArg);

        if (isNaN(targetSeason)) {
          return safeReply(msg,
            "날짜 형식이 올바르지 않습니다.\n(시즌은 숫자여야 합니다)",
            'cmd:클랜통계:season'
          );
        }
      }

      if (month) {
        const targetMonth = Number(month);

        if (isNaN(targetMonth) || targetMonth < 1 || targetMonth > 12) {
          return safeReply(msg,
            "날짜 형식이 올바르지 않습니다.\n(월은 1~12 사이의 숫자여야 합니다)",
            'cmd:클랜통계:month'
          );
        }
      }

      // 진행 안내는 나중에 지워야 해서 메시지 핸들이 필요하다(safeReply는 boolean만 준다).
      // 보낼 수 없는 채널이면 진행 안내는 건너뛰고 본 작업만 진행한다.
      const processingMsg = canSend(msg.channel)
        ? await msg.reply("데이터를 수집하고 엑셀을 생성 중입니다... ⏳").catch(() => null)
        : null;

      try {
        await statsService.send_excel_file(msg, seasonArg, month, guildId);
        await processingMsg?.delete().catch(() => {});
      } catch (error) {
        await processingMsg?.delete().catch(() => {});
        res.error(msg, error);
      }
    },
  },
];
