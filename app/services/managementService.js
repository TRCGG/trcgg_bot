const managementClient = require('../client/managementClient');
const stringUtils = require('../utils/stringUtils');

/**
 * 관리 service
 */

/**
 * @description !doc
 * @returns embed
 */
const get_doc_embed = async () => {
  const field_search_value = [
    "`!전적 [닉네임#태그]` 플레이어 전적 (생략 시 내 디코별명)",
    "`!장인 챔피언` 챔피언 장인 랭킹",
    "`!결과 게임ID` 경기 결과 상세",
  ].join("\n");

  const field_recruit_value = [
    "`!내전모집 [인원] [메모]` 모집 패널 열기 (축약 `!ㄴㅈ`)",
    "> 참가 · 취소 · 📋명단 복사 · ⚙️관리(개최자/관리자)",
    "> 인원 2~40(기본 10) · 최대 5개 · 12시간 뒤 자동 종료",
  ].join("\n");

  const field_admin_value = [
    "`!부캐저장 부캐#태그/본캐#태그` 부계정 연동",
    "`!부캐삭제 부캐#태그` 부계정 연동 해제",
    "`!부캐목록` 연동된 부계정 목록",
    "`!탈퇴 닉네임#태그` · `!복귀 닉네임#태그` 검색 제외·복구",
    "`!drop 게임ID` 경기 기록 삭제",
    "`!클랜통계 [년] [월]` 클랜 통계 CSV (생략 시 시즌 전체)",
    "`!클랜원목록` 클랜원 목록 파일",
  ].join("\n");

  const embedData = {
    title: "📖 GMOK 명령어",
    description: "리플(.rofl)을 올리면 전적이 자동 등록됩니다. `[ ]`는 생략 가능",
    fields: [
      { name: "🔍 검색", value: field_search_value, inline: false },
      { name: "⚔️ 내전 모집", value: field_recruit_value, inline: false },
      { name: "🛠️ 관리자", value: field_admin_value, inline: false },
    ],
    components: stringUtils.createLinkButtonRow([
      { url: "https://gmok.kr", label: "🌐 gmok.kr" },
    ]),
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




