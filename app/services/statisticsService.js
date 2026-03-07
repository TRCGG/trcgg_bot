const statisticsClient = require("../client/statisticsClient");
const stringUtils = require("../utils/stringUtils");
const ExcelJS = require('exceljs');

/**
 * @param {*} msg
 * @param {*} args
 * @description !장인 Embed
 * @returns
 */
const get_master_of_champion_embed = async (msg, args) => {
  const champ_name = args.join(" ").replace(/\s/g, "").trim();
  const guild_id = stringUtils.encodeGuildId(msg.guild.id);
  const champ_data = await statisticsClient.get_master_of_champion_record(
    champ_name,
    guild_id
  );

  if(champ_data.length === 0) {
    return `${champ_name} 검색 결과가 없습니다.`;
  }

  // 1. 유동적 승률 컷라인 계산
  const maxPlayCount = Math.max(...champ_data.map((d) => d.totalCount));

  let minGamesLimit = 10; 
  if (maxPlayCount < 10) minGamesLimit = 3;
  else if (maxPlayCount < 20) minGamesLimit = 5; 

  // 3. 랭킹 정렬
  // 3-1. 많이한 순 (판수 내림차순 -> 승률 내림차순)
  const countRankData = [...champ_data]
    .sort(
      (a, b) =>
        b.totalCount - a.totalCount ||
        parseFloat(b.winRate) - parseFloat(a.winRate)
    )
    .slice(0, 10);

  // 3-2. 잘하는 순 (컷라인 이상 -> 승률 내림차순 -> 판수 내림차순)
  const winRateRankData = champ_data
    .filter((record) => record.totalCount >= minGamesLimit)
    .sort(
      (a, b) =>
        parseFloat(b.winRate) - parseFloat(a.winRate) ||
        b.totalCount - a.totalCount
    )
    .slice(0, 10);

  const fieldOneValue = makeRankString(countRankData);
  const fieldTwoValue = makeRankString(winRateRankData);

  // 5. 썸네일 (옵션)
  // 챔피언 영문명이 데이터에 없어서 생략하거나, 매핑 테이블이 필요함.
  // 일단은 텍스트 위주로 구성

  const embedData = {
    title: `${champ_name} 장인 랭킹`,
    description: `최소 컷라인: ${minGamesLimit}판`,
    color: 0xffd700,
    fields: [
      {
        name: `최다 플레이 (Top 10)`,
        value: fieldOneValue,
        inline: true,
      },
      {
        name: `최고 승률 (Top 10)`,
        value: fieldTwoValue,
        inline: true,
      },
    ],
    footer: {
      text: `총 ${champ_data.length}개의 포지션 데이터가 분석되었습니다.`,
    },
  };

  return stringUtils.createEmbed(embedData);
};

/**
 * @description !클랜통계
 * @returns
 */
const send_excel_file = async (msg, year, month, guildId) => {
  const userData = await statisticsClient.get_user_data(year, month, guildId);
  if(userData.length === 0) {
    msg.reply(`${year} ${month} 해당 데이터가 없습니다.`);
    return;
  }

  try {
    // 1. 데이터 가공 (엑셀에 들어갈 형태로 변환)
    const excelData = userData.map((user) => ({
      '닉네임': `${user.riotName}#${user.riotNameTag}`,
      '총 게임 수': user.totalCount,
      '승': user.win,
      '패': user.lose,
      '승률 (%)': `${user.winRate}%`,
    }));

    // 2. 워크북 및 워크시트 생성
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('UserStats');

    worksheet.columns = [
      { header: '닉네임',    key: '닉네임',    width: 25 },
      { header: '총 게임 수', key: '총 게임 수', width: 10 },
      { header: '승',        key: '승',        width: 5  },
      { header: '패',        key: '패',        width: 5  },
      { header: '승률 (%)',  key: '승률 (%)',  width: 10 },
    ];

    worksheet.addRows(excelData);

    // 3. 엑셀 파일 버퍼 생성
    const excelBuffer = await workbook.xlsx.writeBuffer();

    // 4. 파일명 생성 (년/월 유무에 따라 변경)
    let fileName = '전적통계.xlsx';
    if (year && month) {
      fileName = `${year}년_${month}월_전적통계.xlsx`;
    } else if (year) {
      fileName = `${year}년_전적통계.xlsx`;
    }

    // 5. 디스코드 메시지로 전송
    await msg.channel.send({
      content: `📊 **${fileName.replace('.xlsx', '')}** 데이터를 엑셀 파일로 추출했습니다.`,
      files: [{
        attachment: excelBuffer,
        name: fileName
      }]
    });

  } catch (error) {
    console.error('엑셀 파일 생성 중 오류 발생:', error);
    throw error;
  }
};

/**
 * @desc 랭킹 문자열 생성 헬퍼 함수
 */
const makeRankString = (dataList) => {
  if (dataList.length === 0) return "데이터 없음";

  return dataList
    .map((data, index) => {
      let rankIcon = `${index + 1}.`;
      if (index === 0) rankIcon = "🥇";
      if (index === 1) rankIcon = "🥈";
      if (index === 2) rankIcon = "🥉";

      const winRate = Math.round(parseFloat(data.winRate));
      const posStr = data.position ? `[${data.position}]` : "";

      return `${rankIcon} ${data.riotName} ${posStr} (${data.totalCount}판 ${winRate}% ${data.kda})`;
    })
    .join("\n");
};

module.exports = {
  get_master_of_champion_embed,
  send_excel_file
}



