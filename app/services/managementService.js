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

  // 3. 관리자 명령어 
  const field_admin_value =
    "> ⚠️ **관리자 권한 필수 / 닉네임#태그 정확히 입력**\n\n" +
    "`!부캐목록` : 등록된 모든 부계정 리스트 확인\n" +
    "`!부캐저장 [부캐#태그/본캐#태그]` : 부계정 연동 (전적 합산)\n" +
    "`!부캐삭제 [부캐#태그]` : 부계정 연동 해제\n" +
    "`!탈퇴 [닉네임#태그]` : 전적 검색 제외 처리\n" +
    "`!복귀 [닉네임#태그]` : 전적 검색 다시 활성화\n" +
    "`!drop [리플파일명]` : 잘못된 리플 데이터 삭제\n" +
    "`!클랜통계 [년] [월]` : 클랜 전체 통계 조회(액셀파일)\n" +
    "`!대회개설 [이름]` : 대회 시작 (길드당 하나)\n" +
    "`!대회종료` : 진행 중인 대회 종료 (이후 리플 등록 불가)\n" +
    "`!대회삭제 [이름]` : 경기 없는 대회 삭제\n" +
    "`!대회목록` : 대회와 경기 수 확인";

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




