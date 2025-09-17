const { PermissionsBitField } = require('discord.js');

/**
 * @param {Object/String} jsonData 
 * @description embed 형식의 jsondata, string 일경우 그대로 return
 */
const createEmbed = (jsonData) => {
  if (typeof jsonData === "string") {
    return jsonData;
  } else {
    const embed = {
      title: jsonData.title,
      description: jsonData.description || null,
      fields: jsonData.fields || null,
      color: jsonData.color || null,
    };
    return { embeds: [embed] };
  }
};

/**
 * @param {*} msg 
 * @param {*} args 
 * @description 닉네임을 가져온다
 * @returns 
 */
const getMemberNick = (msg, args) => {
  let riot_name = null;
  let riot_name_tag = null;
  let riot_name_with_tag = null;
  if (args[0] === undefined) {
    if (msg.member.nickname !== undefined) {
      riot_name = msg.member.nickname;
      riot_name = riot_name.split("/")[0];
      riot_name_with_tag = riot_name.split("#");
      if(riot_name_with_tag.length > 1) {
        return [riot_name_with_tag[0].trim(), riot_name_with_tag[1].trim()];
      } else {
        return [riot_name_with_tag[0].trim(), null];
      }
    } else {
      throw new Error("별명 설정 필요");
    }
  } else {
    const full_name = args.join(" ");
    if (full_name.includes("#")) {
      [riot_name, riot_name_tag] = full_name.split("#");
      riot_name = riot_name.trim();
      riot_name_tag = riot_name_tag.trim();
      return [riot_name, riot_name_tag];
    } else {
      return [full_name.trim(), null];
    }
  }
};

/**
 * @param {*} msg 
 * @description 권한체크
 * @returns 
 */
const checkAuth = (msg) => {

  const ALLOWED_ROLE_NAMES = new Set(['내전봇관리자']);
  const member = msg.member;
  if (!member) return false;

  // 지정 역할 보유 여부
  const hasAllowedRole = member.roles.cache.some(r => ALLOWED_ROLE_NAMES.has(r.name));

  // 길드 서버 관리 권한 또는 관리자 권한 보유 여부
  const hasGuildManagePerm =
    member.permissions.has(PermissionsBitField.Flags.ManageGuild) ||
    member.permissions.has(PermissionsBitField.Flags.Administrator);

  return hasAllowedRole || hasGuildManagePerm;
};

/**
 * 날짜 분리
 * @param {*} date 
 * @returns 
 */
const splitDate = (date) => {
  if (!date) {
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    return [year, month];
  }

  if (typeof date !== 'string') {
    console.error('유효하지 않은 입력 타입:', typeof date);
    throw new Error("날짜 형식 오류");
  }

  const [year, month] = date.split('-');

  if (!year || !month ||
    isNaN(year) ||
    isNaN(month) ||
    month.length !== 2) {
      console.error('잘못된 날짜 형식:', date);
      throw new Error("날짜 형식 오류");
  }

  return [year, month];
};

/**
 * 슬래쉬 문자열 분리
 * @param {*} str 
 * @returns 
 */
const splitStr = (str) => {
  if (!str) {
    throw new Error("입력된 문자열이 비어있습니다");
  }

  const [sub_name, main_name] = str.split('/');

  if (!sub_name || !main_name) {
    throw new Error("잘못된 형식 !doc를 참고해주세요");
  }
  return [sub_name, main_name];
};

/**
* # 문자열 분리
* @param {*} str 
* @returns 
*/
const splitTag = (str) => {
  if (!str) {
    throw new Error("입력값이 비어있습니다");
  }
  const [name, name_tag] = str.split('#');

  if (!name || !name_tag) {
    console.log("잘못된 태그 형식:", str);
    throw new Error("닉네임#태그 값을 입력해주세요");
  }

  return [name, name_tag];
};

/**
 * # 태그 검증
 * @param {*} str 
 * @returns 
 */
const validateTag = (str) => {
  const pattern = /^[가-힣a-zA-Z0-9]{1,16}#[가-힣a-zA-Z0-9]{1,16}$/;

  if (!str) {
    throw new Error("태그 문자열이 비어있습니다");
  }

  if (!pattern.test(str)) {
    console.log("유효하지 않은 태그:", str);
    throw new Error("유요하지 않은 태그");
  }

  return true;
};

/**
 * @param {String} guild_id
 * @description 길드 ID Base64 인코딩
 */
const encodeGuildId = (guild_id) => {
  if (!guild_id) {
    throw new Error("길드 ID가 비어있습니다");
  }

  const encodedId = Buffer.from(guild_id.toString(), 'utf8').toString('base64');
  return encodedId;
}

module.exports = {
  createEmbed,
  getMemberNick,
  checkAuth,
  splitDate,
  splitStr,
  splitTag,
  validateTag,
  encodeGuildId,
};
