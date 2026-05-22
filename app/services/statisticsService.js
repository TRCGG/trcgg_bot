const statisticsClient = require("../client/statisticsClient");
const stringUtils = require("../utils/stringUtils");
const ExcelJS = require('exceljs');

const season = process.env.SEASON || "2025";

const POSITION_LABEL = { TOP: "T", JUG: "J", MID: "M", ADC: "A", SUP: "S" };

/**
 * @description !장인 Embed
 */
const get_master_of_champion_embed = async (msg, args) => {
  const champ_name = args.join(" ").replace(/\s/g, "").trim();
  const guild_id = stringUtils.encodeGuildId(msg.guild.id);

  const [champRecordResult, championSummaryResult] = await Promise.allSettled([
    statisticsClient.get_master_of_champion_record(champ_name, guild_id),
    statisticsClient.get_champion_statistics(guild_id),
  ]);
  const champ_data = champRecordResult.status === "fulfilled" ? champRecordResult.value : [];
  const champion_summary_data = championSummaryResult.status === "fulfilled" ? championSummaryResult.value : [];

  if (champRecordResult.status === "rejected") {
    throw champRecordResult.reason;
  }

  if (champ_data.length === 0) {
    return `${champ_name} 검색 결과가 없습니다. ${season} 시즌 전체 기준입니다.`;
  }

  const championSummary = findChampionStats(champion_summary_data, champ_name);

  const maxPlayCount = Math.max(...champ_data.map((d) => d.totalCount));

  let minGamesLimit = 10;
  if (maxPlayCount < 10) minGamesLimit = 3;
  else if (maxPlayCount < 20) minGamesLimit = 5;

  const countRankData = [...champ_data]
    .sort(
      (a, b) =>
        b.totalCount - a.totalCount ||
        parseFloat(b.winRate) - parseFloat(a.winRate)
    )
    .slice(0, 10);

  const winRateRankData = champ_data
    .filter((record) => record.totalCount >= minGamesLimit)
    .sort(
      (a, b) =>
        parseFloat(b.winRate) - parseFloat(a.winRate) ||
        b.totalCount - a.totalCount
    )
    .slice(0, 10);

  const embedData = {
    title: `${champ_name} 장인 랭킹`,
    description: `${season} 시즌 전체 기준`,
    color: 0xffd700,
    fields: [
      {
        name: "챔피언 요약",
        value: makeChampionSummaryString(championSummary),
        inline: false,
      },
      {
        name: "최다 플레이 (Top 10)",
        value: makeRankString(countRankData),
        inline: true,
      },
      {
        name: "최고 승률 (Top 10)",
        value: makeRankString(winRateRankData),
        inline: true,
      },
    ],
    footer: {
      text: `총 ${champ_data.length}명의 유저 데이터를 분석했습니다.`,
    },
  };

  return stringUtils.createEmbed(embedData);
};

/**
 * @description !클랜통계
 */
const send_excel_file = async (msg, seasonArg, month, guildId) => {
  const userData = await statisticsClient.get_user_data(seasonArg, month, guildId);
  const targetSeason = seasonArg || season;
  const periodLabel = getPeriodLabel(targetSeason, month);

  if (!Array.isArray(userData) || userData.length === 0) {
    msg.reply(`${periodLabel} 해당 데이터가 없습니다.`);
    return;
  }

  try {
    const sortedUserData = [...userData].sort(
      (a, b) =>
        b.totalCount - a.totalCount ||
        parseFloat(b.winRate) - parseFloat(a.winRate)
    );

    const excelData = sortedUserData.map((user) => ({
      "닉네임": `${user.riotName}#${user.riotNameTag}`,
      "총 게임 수": user.totalCount,
      "승": user.win,
      "패": user.lose,
      "승률 (%)": `${user.winRate}%`,
    }));

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("UserStats");

    worksheet.columns = [
      { header: "닉네임", key: "닉네임", width: 25 },
      { header: "총 게임 수", key: "총 게임 수", width: 10 },
      { header: "승", key: "승", width: 5 },
      { header: "패", key: "패", width: 5 },
      { header: "승률 (%)", key: "승률 (%)", width: 10 },
    ];

    worksheet.addRows(excelData);

    const excelBuffer = await workbook.xlsx.writeBuffer();

    let fileName = `${targetSeason}시즌_전적통계.xlsx`;
    if (month) {
      fileName = `${targetSeason}시즌_${month}월_전적통계.xlsx`;
    } else if (seasonArg) {
      fileName = `${targetSeason}시즌_전적통계.xlsx`;
    }

    await msg.channel.send({
      content: `**${periodLabel} 클랜통계** 데이터를 엑셀 파일로 추출했습니다.`,
      files: [{
        attachment: excelBuffer,
        name: fileName
      }]
    });

  } catch (error) {
    console.error("엑셀 파일 생성 중 오류 발생:", error);
    throw error;
  }
};

const makeRankString = (dataList) => {
  if (dataList.length === 0) return "데이터 없음";

  return dataList
    .map((data, index) => {
      const rank = `${index + 1}.`;
      const winRate = formatNumber(data.winRate, 0);
      const posStr = data.position ? `[${POSITION_LABEL[data.position] ?? data.position}]` : "";
      const kda = data.kda !== undefined && data.kda !== null ? ` KDA ${formatNumber(data.kda, 2)}` : "";

      return `${rank} ${data.riotName} ${posStr} (${data.totalCount}판 / ${winRate}%${kda})`;
    })
    .join("\n");
};

/**
 * @description 챔피언 전체 통계 요약 문자열 생성
 */
const makeChampionSummaryString = (summary) => {
  if (!summary) {
    return "챔피언 전체 통계 데이터 없음";
  }

  const winRate = formatNumber(summary.winRate, 0);
  const kda = summary.kda !== undefined && summary.kda !== null ? ` / KDA ${formatNumber(summary.kda, 2)}` : "";

  return `총 ${summary.totalCount}판 / 승률 ${winRate}%${kda}`;
};

/**
 * @description 챔피언명으로 단일 챔피언 통계 조회
 */
const findChampionStats = (stats, champName) => {
  return findChampionStatsList(stats, champName)[0] || null;
};

/**
 * @description 챔피언명으로 일치하는 챔피언 통계 목록 조회
 */
const findChampionStatsList = (stats, champName) => {
  if (!Array.isArray(stats)) return [];

  const normalizedChampName = normalizeChampionName(champName);

  return stats.filter((stat) => {
    return [stat.champName, stat.champNameEng]
      .filter(Boolean)
      .some((name) => normalizeChampionName(name) === normalizedChampName);
  });
};

/**
 * @description 챔피언명 비교를 위한 정규화
 */
const normalizeChampionName = (name) => {
  return String(name || "").replace(/\s/g, "").toLowerCase();
};

/**
 * @description 숫자 표시용 포맷팅
 */
const formatNumber = (value, fractionDigits = 0) => {
  const number = Number(value);
  if (Number.isNaN(number)) return "0";

  return number.toFixed(fractionDigits).replace(/\.0+$/, "");
};

/**
 * @description 클랜통계 조회 기간 표시 문자열 생성
 */
const getPeriodLabel = (targetSeason, month) => {
  if (!month) return `${targetSeason} 시즌 전체`;

  return `${targetSeason} 시즌 ${month}월`;
};

module.exports = {
  get_master_of_champion_embed,
  send_excel_file
}
