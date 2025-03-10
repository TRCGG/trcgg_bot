const httpClient = require('../utils/networkUtils');
const prefix = '/management';

/**
 * 관리 api call
 */

/**
 * @description !설명
 * @returns embed 
 */
const get_doc = async() => {
	const url = `${prefix}/doc`;
	return httpClient.get(url);
}

/**
 * @param {String} guild_id
 * @description !부캐목록
 * @returns {Object} Embed 형식 Json
 */
const get_sublist = async(guild_id) => {
	const url = `${prefix}/sublist/${guild_id}`;
	return httpClient.get(url);
}

/**
 * @param {String} data.sub_name 부캐 닉네임
 * @param {String} data.sub_name_tag 부캐 태그
 * @param {String} data.main_name 본캐 닉네임
 * @param {String} data.main_name_tag 본캐 태그
 * @param {String} guild_id 길드 ID
 * @description !부캐저장
 * @returns {string} message
 */
const post_subaccount = async(data, guild_id) => {
	const url = `${prefix}/subaccount/${guild_id}`;
	return httpClient.post(url, data);
}

/**
 * @param {String} data.sub_name 부캐 닉네임
 * @param {String} data.sub_name_tag 부캐 태그
 * @param {String} guild_id
 * @description !부캐삭제
 * @returns {String} message
 */
const put_subaccount = async(data, guild_id) => {
	const url = `${prefix}/subaccount/${guild_id}`;
	return httpClient.put(url, data);
}

/**
 * @param {String} data.delete_yn (Y/N)
 * @param {String} data.riot_name 라이엇 닉네임 
 * @param {String} data.riot_name_tag 라이엇 태그
 * @param {String} guild_id 길드 ID
 * @description !탈퇴, !복귀
 * @returns {String} message
 */
const put_accountstatus = async(data, guild_id) => {
	const url = `${prefix}/accountstatus/${guild_id}`;
	return httpClient.put(url, data);
}

/**
 * @param {String} data.old_name 기존 닉네임
 * @param {String} data.old_name_tag 기존 태그
 * @param {String} data.new_name 새 닉네임
 * @param {String} data.new_name_tag 새 태그
 * @param {String} guild_id 길드 ID
 * @description !닉변
 * @returns {String} message
 */
const put_accountname = async(data, guild_id) => {
	const url = `${prefix}/accountname/${guild_id}`;
	return httpClient.put(url, data);
}

module.exports = {
	get_doc,
	get_sublist,
	post_subaccount,
	put_subaccount,
	put_accountstatus,
	put_accountname,
}




