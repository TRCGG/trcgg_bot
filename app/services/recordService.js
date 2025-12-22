const recordClient = require('../client/recordClient');
const stringUtils = require('../utils/stringUtils');
/**
 * 전적 api call service
 */

/**
 * @param {*} msg
 * @param {*} args
 * @description !전적 조회에 필요한 모든 데이터 조회
 */
const get_all_record_embed = async(msg, args) => {
  const [riotName, riotNameTag] = stringUtils.getMemberNick(msg, args);
  if (riotName.length < 2 || riotNameTag) {
    return "✅ 닉네임 태그 모두 두 글자 이상 입력해주세요";
  }
  const guildId = stringUtils.encodeGuildId(msg.guild.id);
  const result = await recordClient.get_all_record(riotName, riotNameTag, guildId);
  const games = await recordClient.get_recent_record(riotName, riotNameTag, guildId);

  if (!result) {
    return "데이터를 찾지 못했습니다";
  }

  if (Array.isArray(result)) {
    if (result.length >= 2) {
      // 다중 계정 선택 Embed 생성 후 리턴
      const multiAccountEmbed = getPlayersEmbed(result);
      return stringUtils.createEmbed(multiAccountEmbed);
    } 
  }

  const { member, summary, lines, mostPicks, synergy } = result;

  // 1. 통합 전적 계산 (lines 데이터 합산)
  let allTotal = 0;
  let allWin = 0;
  let allLose = 0;
  let maxLineCount = 0;

  // 합산 및 최다 판수 라인 찾기
  lines.forEach((line) => {
    allTotal += line.totalCount;
    allWin += line.win;
    allLose += line.lose;

    if (line.totalCount > maxLineCount) {
      maxLineCount = line.totalCount;
    }
  });

  const allWinRate = allTotal > 0 
    ? ((allWin / allTotal) * 100).toFixed(2) 
    : "0.00";

  const allStatsHeader = `통합전적: ${allTotal}전 ${allWin}승 ${allLose}패 (${allWinRate}%)`;
  const monthStats = `이번달: ${summary.totalCount}전 ${summary.win}승 ${summary.lose}패 (${summary.winRate}%) KDA: ${summary.kda}`;

  // 2. 포지션 정보 (라인별)
  let lineDesc = "";
  lines.forEach((line) => {
    const isMostLine = line.totalCount === maxLineCount ? ":thumbsup:" : "";
    lineDesc += `${isMostLine}${line.position}: ${line.win}승 ${line.lose}패 ${line.winRate}% (KDA ${line.kda}) \n`;
  });

  // Embed Description 조합
  const description = `${monthStats}\n\n**${allStatsHeader}**\n${lineDesc}`;

  const recentData = games ? games.slice(0, 5) : []; 
  
  let recentWin = 0;
  let recentLose = 0;
  let recentValue = "";

  recentData.forEach((game) => {
    let colorIcon = "";
    
    // JSON 데이터의 gameResult ("승"/"패") 확인
    if (game.gameResult === "승") {
      recentWin += 1;
      colorIcon = ":blue_circle:";
    } else {
      recentLose += 1;
      colorIcon = ":red_circle:";
    }

    const kda = `${game.kill}/${game.death}/${game.assist}`;
    recentValue += `${colorIcon} ${game.champName} ${kda} (${game.gameId}) \n`;
  });

  const recentHeader = `최근 ${recentData.length}전 ${recentWin}승 ${recentLose}패`;

  // 3. 모스트 픽 (상위 5개만 표시 추천)
  let mostPickValue = "";
  mostPicks.slice(0, 5).forEach((pick) => {
    // 승률에 따라 이모지 장식 (선택사항)
    const winRate = parseFloat(pick.winRate);
    const winEmoji = winRate >= 60 ? ":star:" : "";
    
    mostPickValue += `${pick.champName}: ${pick.totalCount}판 ${pick.winRate}% (${pick.kda}) ${winEmoji}\n`;
  });

  // 4. 시너지 (같이 게임한 플레이어)
  // 승률 50% 이상(Blue)과 미만(Red)으로 분류
  // let goodSynergyValue = "";
  // let badSynergyValue = "";

  // 시너지 데이터가 있는 경우에만 처리
  // if (synergy && synergy.length > 0) {
  //   synergy.forEach((player) => {
  //     const winRate = parseFloat(player.winRate);
  //     const row = `${player.riotName}: ${player.win}승 ${player.lose}패 ${player.winRate}%\n`;
      
  //     if (winRate >= 50) {
  //       goodSynergyValue += row;
  //     } else {
  //       badSynergyValue += row;
  //     }
  //   });
  // }

  // Embed 객체 생성
  const fields = [
    {
      name: recentHeader,
      value: recentValue || "기록 없음",
      inline: false,
    },
    {
      name: "Most Pick :trophy:",
      value: mostPickValue || "기록 없음",
      inline: false,
    }
  ];

  // // 시너지 필드 추가 (데이터가 있을 때만)
  // if (goodSynergyValue) {
  //   fields.push({
  //     name: "함께해서 영광 :blue_heart:",
  //     value: goodSynergyValue,
  //     inline: true,
  //   });
  // }
  
  // if (badSynergyValue) {
  //   fields.push({
  //     name: "억제기 :broken_heart:",
  //     value: badSynergyValue,
  //     inline: true,
  //   });
  // }

  const frontendUrl = process.env.NODE_ENV === 'development' 
? 'https://dev.gmok.kr' 
: 'https://gmok.kr';
  const homepageUrl = encodeURI(`${frontendUrl}/summoners/${member.riotName}/${member.riotNameTag}`);

  const embedData = {
    title: `${member.riotName}#${member.riotNameTag}`,
    url: homepageUrl,
    description: description,
    fields: fields,
    footer: {
      text: "Gmok Match Dashboard"
    }
  };

  return stringUtils.createEmbed(embedData);
}

/**
 * @param {*} msg
 * @param {*} args
 * @description !결과 Embed
 * @returns
 */
const get_result_record_embed = async(msg, args) => {
  const game_id = args.join(" ");
  if(!game_id) {
    throw new Error("Game Id를 입력해주세요. (ex: RPY-20260205-xxxxxx-001)");
  }
  const guild_id = stringUtils.encodeGuildId(msg.guild.id);
  const game_data = await recordClient.get_result_record(game_id, guild_id);

  // 1. 승리 팀 판별 (전체 데이터 중 '승'인 플레이어의 팀 확인)
  const winnerNode = game_data.find(p => p.gameResult === "승");
  const winningTeam = winnerNode ? winnerNode.gameTeam : null; // 'blue' or 'red'

  // 2. 팀별 데이터 분리
  const blueTeamData = game_data.filter(p => p.gameTeam === "blue");
  const redTeamData = game_data.filter(p => p.gameTeam === "red");

  // 3. 필드 헤더 생성
  const blueHeader = setLineFieldHeader("blue", winningTeam);
  const redHeader = setLineFieldHeader("red", winningTeam);

  // 4. 필드 내용 생성 (플레이어 목록)
  const blueValue = makeTeamListValue(blueTeamData);
  const redValue = makeTeamListValue(redTeamData);

  const embedData = {
    title: "결과 상세",
    description: `경기 일시: <t:${Math.floor(new Date(game_data[0].createDate).getTime() / 1000)}:f>`, // 날짜 표시
    color: 0x0099ff,
    fields: [
      {
        name: blueHeader,
        value: blueValue || "데이터 없음",
        inline: false,
      },
      {
        name: redHeader,
        value: redValue || "데이터 없음",
        inline: false,
      },
    ],
    footer: {
      text: `Game ID: ${game_id}`
    }
  };
  return stringUtils.createEmbed(embedData);
}


/**
 * @param {*} accounts
 * @description 계정조회 2명 이상일 경우 선택창 표시
 */
const getPlayersEmbed = (accounts) => {
  let desc = "";
  accounts.forEach((account) => {
    desc += `${account.riotName}#${account.riotNameTag} \n`;
  });
  
  return {
    title: "검색결과",
    description: desc,
    fields: null,
  };
};

/**
 * 팀 헤더 생성 
 * @param {string} team 'blue' | 'red'
 * @param {string} winningTeam 'blue' | 'red'
 */
const setLineFieldHeader = (team, winningTeam) => {
  let header = "";
  
  if (team === "blue") {
    header = ":blue_circle: **블루팀**";
  } else {
    header = ":red_circle: **레드팀**";
  }

  if (team === winningTeam) {
    header += " :v:";
  }

  return header;
};

/**
 * 팀원 목록 문자열 생성
 * @param {Array} teamData 해당 팀의 플레이어 배열
 */
const makeTeamListValue = (teamData) => {
  if (!teamData || teamData.length === 0) return "데이터 없음";

  let listStr = "";
  
  teamData.forEach((p) => {
    const kda = `${p.kill}/${p.death}/${p.assist}`;
    listStr += `**${p.riotName}** ${p.champName} (${kda})\n`;
  });

  return listStr;
};

module.exports = {
  get_all_record_embed,
  get_result_record_embed,
}






