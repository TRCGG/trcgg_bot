const managementClient = require('../client/managementClient');
const stringUtils = require('../utils/stringUtils');

/**
 * 관리 service
 */

/**
 * @description !설명
 * @returns embed 
 */
const get_doc_embed = async () => {
  // 1. 홈페이지 & 기본 정보
  const field_home_value = 
    "🌐 **[내전 봇 홈페이지 바로가기](https://gmok.kr)**\n" +
    "> 내전 결과 및 상세 통계를 웹에서 확인하세요.";

  // 2. 검색 명령어 
  const field_search_value =
    "`!전적 [닉네임]` : 플레이어의 전적을 검색합니다.\n" +
    "`!장인 [챔피언]` : 챔피언별 승률/픽률 장인을 확인합니다.\n" +
    "`!결과 [리플파일명]` : 특정 내전의 결과를 조회합니다.";

  // 3. 내전 모집
  const field_recruit_value =
    "`!내전모집 [인원] [메모]` : 채널에 참가 신청 패널을 엽니다.\n" +
    "> 예) `!내전모집` · `!내전모집 10 21시 시작` (인원 2~40, 기본 10)\n" +
    "> 축약: `!ㄴㅈ` (예: `!ㄴㅈ 10 21시 시작`)\n" +
    "> 서버 동시 최대 5개, 개설 12시간 뒤 자동 종료\n" +
    "> 서버별로 1차·2차… 자동 표시 (매일 낮 12시 초기화)\n\n" +
    "✋ **참가** : 정원이 차면 대기 명단에 등록\n" +
    "**취소** : 참가 취소, 빈자리는 대기 1번이 자동 참가 (DM 알림, DM 차단 시 채널 멘션)\n" +
    "📋 **명단 복사** : 참가 명단(한 줄에 한 명) + 전체 멘션 텍스트 출력 (복사해서 붙여넣기)\n" +
    "⚙️ **관리** : 개최자·관리자 전용 — 추방 / 마감·재개 / 종료\n" +
    "> 추방하면 누가 누구를 뺐는지 채널에 공개 기록이 남습니다.";

  // 4. 관리자 명령어
  const field_admin_value =
    "> ⚠️ **관리자 권한 필수 / 닉네임#태그 정확히 입력**\n\n" +
    "`!부캐목록` : 등록된 모든 부계정 리스트 확인\n" +
    "`!부캐저장 [부캐#태그/본캐#태그]` : 부계정 연동 (전적 합산)\n" +
    "`!부캐삭제 [부캐#태그]` : 부계정 연동 해제\n" +
    "`!탈퇴 [닉네임#태그]` : 전적 검색 제외 처리\n" +
    "`!복귀 [닉네임#태그]` : 전적 검색 다시 활성화\n" +
    "`!drop [리플파일명]` : 잘못된 리플 데이터 삭제\n" +
    "`!클랜통계 [년] [월]` : 클랜 전체 통계 조회(액셀파일)";

  const embedData = {
    title: "명령어 가이드",
    description: "봇 사용을 위한 명령어 목록입니다.\n명령어 사용 시 `[ ]` 괄호는 제외하고 입력해주세요.",
    fields: [
      {
        name: "홈페이지",
        value: field_home_value,
        inline: false,
      },
      {
        name: "일반 명령어",
        value: field_search_value,
        inline: false,
      },
      {
        name: "내전 모집",
        value: field_recruit_value,
        inline: false,
      },
      {
        name: "관리자 전용 명령어",
        value: field_admin_value,
        inline: false,
      },
    ],
    footer: { text: "Gmok Bot System" } 
  };

  return stringUtils.createEmbed(embedData);
};

/**
 * @description !부캐목록
 */
const get_sublist_embed = async(msg) => {
	const guild_id = stringUtils.encodeGuildId(msg.guild.id);
	const accounts = await managementClient.get_sublist(guild_id);

	const title = "부캐목록";
    let desc = "``` \n" + "|  부캐  |  본캐  |\n" + "\n";

    accounts.forEach((data) => {
      desc += `| ${data.subRiotName}#${data.subRiotNameTag} | ${data.mainRiotName}#${data.mainRiotNameTag} \n`;
    });

    let size = accounts.length;

    desc += "\n";
    desc += `총 : ${size} \n`;
    desc += "```";

    const embedData = {
      title: title,
      description: desc,
      fields: [],
    };

	return stringUtils.createEmbed(embedData);
}

/**
 * @param {*} msg
 * @param {*} args sub_name#sub_name_tag/main_name#main_name_tag
 * @description !부캐저장
 * @returns {string} message
 */
const post_subaccount = async(msg, args) => {
	const nick_name = args.join(" ").trim();
	const [ sub_full_name, main_full_name ] = stringUtils.splitStr(nick_name);
	const [ sub_name, sub_name_tag ] = stringUtils.splitTag(sub_full_name);
	const [ main_name, main_name_tag ] = stringUtils.splitTag(main_full_name);
	const data = {
		guildId: msg.guild.id,
		subRiotName : sub_name,
		subRiotTag : sub_name_tag, 
		mainRiotName : main_name,
		mainRiotTag : main_name_tag	
	}

	const resultMessage = await managementClient.post_subaccount(data);
	return resultMessage;
}

/**
 * @description !탈퇴, !복귀
 */
const put_accountstatus = async(status, msg, args) => {
	const nick_name = args.join(" ").trim();
	const [ riot_name, riot_name_tag ] = stringUtils.splitTag(nick_name);
	const data = {
		guildId : msg.guild.id,
		riotName : riot_name,
		riotNameTag : riot_name_tag,
		status : status
	}

	const resultMessage = await managementClient.put_accountstatus(data);
	return resultMessage;
}

/**
 * @param {*} msg
 * @param {*} args sub_name#sub_name_tag
 * @description !부캐삭제
 * @returns {String} message
 */
const delete_subaccount = async(msg, args) => {
	const nick_name = args.join(" ").trim();
	const [ sub_name, sub_name_tag ] = stringUtils.splitTag(nick_name);
	const data = {
		guildId : msg.guild.id,
		riotName : sub_name,
		riotNameTag : sub_name_tag
	}
	const resultMessage = await managementClient.delete_subaccount(data);
	return resultMessage;
}

module.exports = {
	get_doc_embed,
	get_sublist_embed,
	post_subaccount,
	put_accountstatus,
	delete_subaccount,
}




