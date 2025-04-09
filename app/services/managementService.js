const managementClient = require('../client/managementClient');
const stringUtils = require('../utils/stringUtils');

/**
 * 관리 service
 */

/**
 * @description !설명
 * @returns embed 
 */
const get_doc_embed = async() => {
	const embed = await managementClient.get_doc();
	return stringUtils.createEmbed(embed);
}

/**
 * @param {*} msg
 * @param {*} args
 * @description !부캐목록
 * @returns {Object} Embed 형식 Json
 */
const get_sublist_embed = async(msg, args) => {
	const guild_id = stringUtils.encodeGuildId(msg.guild.id);
	const embed = await managementClient.get_sublist(guild_id);
	return stringUtils.createEmbed(embed);
}

/**
 * @param {*} msg
 * @param {*} args sub_name#sub_name_tag/main_name#main_name_tag
 * @description !부캐저장
 * @returns {string} message
 */
const post_subaccount = async(msg, args) => {
	const raw_data = args.join(" ").trim();
	const [ sub_full_name, main_full_name ] = stringUtils.splitStr(raw_data);
	const [ sub_name, sub_name_tag ] = stringUtils.splitTag(sub_full_name);
	const [ main_name, main_name_tag ] = stringUtils.splitTag(main_full_name);
	const data = {
		sub_name : sub_name,
		sub_name_tag : sub_name_tag, 
		main_name : main_name,
		main_name_tag : main_name_tag	
	}
	const guild_id = stringUtils.encodeGuildId(msg.guild.id);

	const resultMessage = await managementClient.post_subaccount(data, guild_id);
	return resultMessage;
}

/**
 * @param {*} delete_yn (Y/N) Y: 탈퇴 N: 복귀
 * @param {*} msg
 * @param {*} args riot_name#riot_name_tag
 * @description !탈퇴, !복귀
 * @returns {String} message
 */
const put_accountstatus = async(delete_yn, msg, args) => {
	const raw_data = args.join(" ").trim();
	const [ riot_name, riot_name_tag ] = stringUtils.splitTag(raw_data);
	const data = {
		delete_yn : delete_yn,
		riot_name : riot_name,
		riot_name_tag : riot_name_tag
	}
	const guild_id = stringUtils.encodeGuildId(msg.guild.id);

	const resultMessage = await managementClient.put_accountstatus(data, guild_id);
	return resultMessage;
}

/**
 * @param {*} msg
 * @param {*} args old_name#old_name_tag/new_name#new_name_tag
 * @description !닉변
 * @returns {String} message
 */
const put_accountname = async(msg, args) => {
	const raw_data = args.join(" ").trim();
	const [ old_full_name, new_full_name ] = stringUtils.splitStr(raw_data);
	const [ old_name, old_name_tag ] = stringUtils.splitTag(old_full_name);
	const [ new_name, new_name_tag ] = stringUtils.splitTag(new_full_name);
	const data = {
		old_name : old_name,
		old_name_tag : old_name_tag, 
		new_name : new_name,
		new_name_tag : new_name_tag	
	}
	const guild_id = stringUtils.encodeGuildId(msg.guild.id);
	const resultMessage = await managementClient.put_accountname(data, guild_id);
	return resultMessage;
}

/**
 * @param {*} msg
 * @param {*} args sub_name#sub_name_tag
 * @description !부캐삭제
 * @returns {String} message
 */
const delete_subaccount = async(msg, args) => {
	const raw_data = args.join(" ").trim();
	const [ sub_name, sub_name_tag ] = stringUtils.splitTag(raw_data);
	const data = {
		sub_name : sub_name,
		sub_name_tag : sub_name_tag
	}
	const guild_id = stringUtils.encodeGuildId(msg.guild.id);
	const resultMessage = await managementClient.delete_subaccount(data, guild_id);
	return resultMessage;
}

module.exports = {
	get_doc_embed,
	get_sublist_embed,
	post_subaccount,
	put_accountstatus,
	put_accountname,
	delete_subaccount,
}




