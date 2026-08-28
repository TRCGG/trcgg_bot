const recordService = require("../services/recordService");
const competitionService = require("../services/competitionService");
const res = require('../utils/responseHandler');
const { safeReply } = require('../utils/discordUtils');

/**
 * 전적 검색 명령어
 * - !전적 [닉네임]              : 일반내전 전적
 * - !전적대회 [닉네임] / [대회명] : 대회(스크림+본경기) 전적. 대회명 생략 시 진행 중(없으면 최근) 대회
 */
module.exports = [
  {
    name: "전적",
    run: async (client, msg, args) => {
      try {
        const result = await recordService.get_all_record_embed(msg, args);
        await safeReply(msg, result);
      } catch (error) {
        res.error(msg, error);
      }
    },
  },
  {
    name: "전적대회",
    run: async (client, msg, args) => {
      try {
        const result = await competitionService.get_competition_record_embed(msg, args);
        await safeReply(msg, result);
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
        await safeReply(msg, result);
      } catch (error) {
        if (error?.message === 'Game not found') {
          const text = args.join(" ");
          await safeReply(msg, `**${text}** 검색 결과가 없습니다.`);
        } else {
          res.error(msg, error);
        }
      }
    },
  },
];
