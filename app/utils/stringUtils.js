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
  if (args[0] === undefined) {
    if (msg.member.nickname !== undefined) {
      riot_name = msg.member.nickname;
      riot_name = riot_name.split("/")[0];
      return [riot_name.trim(), null];
      // return [riot_name.replace(/\s/g, "").replace("й", "n").trim(), null]; //닉네임 마이그레이션 예정
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
  const roles = msg.member.roles.cache;
  const role_names = roles.map((role) => role.name);
  if (
    role_names.includes("난민개발부") ||
    role_names.includes("TRC관리자") ||
    role_names.includes("난민스텝진")
  ) {
    return true;
  } else {
    return false;
  }
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
    console.log("입력된 문자열이 비어있습니다");
    throw new Error("잘못된 형식");
  }

  const [sub_name, main_name] = str.split('/');

  if (!sub_name || !main_name) {
    console.log("잘못된 형식의 문자열:", str);
    throw new Error("잘못된 형식");
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
    console.log("입력된 태그가 비어있습니다");
    throw new Error("잘못된 형식");
  }

  const [name, name_tag] = str.split('#');

  if (!name || !name_tag) {
    console.log("잘못된 태그 형식:", str);
    throw new Error("잘못된 형식");
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
      throw new Error("잘못된 형식");
  }

  return true;
};

module.exports = {
  createEmbed,
  getMemberNick,
  checkAuth,
  splitDate,
  splitStr,
  splitTag,
  validateTag,
};
