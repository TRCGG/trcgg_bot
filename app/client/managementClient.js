const httpClient = require('../utils/networkUtils');
const prefix = '/guildMember';

/**
 * 관리 api call
 */

/**
 * @description !부캐목록
 */
const get_sublist = async(guildId) => {
	const url = `${prefix}/${guildId}/sub-accounts`;
	return httpClient.get(url);
}

/**
 * @description !부캐저장
 */
const post_subaccount = async(data) => {
	const url = `${prefix}/sub-account`;
	// 미등록 계정·동일 계정 연결 시도는 사용자 입력 오류라 정상 분기로 안내된다.
	return httpClient.post(url, data, { expectedStatuses: [400] });
}

/**
 * @description !탈퇴, !복귀
 */
const put_accountstatus = async(data) => {
	const url = `${prefix}/status`;
	return httpClient.put(url, data);
}

/**
 * @description !부캐삭제
 */
const delete_subaccount = async(data) => {
	const url = `${prefix}/sub-account`;
	return httpClient.delete(url, data);
}

module.exports = {
	get_sublist,
	post_subaccount,
	put_accountstatus,
	delete_subaccount,
}




