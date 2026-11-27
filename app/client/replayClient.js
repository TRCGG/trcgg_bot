const httpClient = require('../utils/networkUtils');
const { toPathSegment } = require('../utils/stringUtils');
const prefix = '/replays';

/**
 * 리플레이 api
 */

/**
 * @param {String} data.fileUrl
 * @param {String} data.fileName
 * @param {String} data.createUser
 * @param {String} guildId
 * @description 리플레이 저장
 * @returns {String} message
 */
const post_replay = async(data) => {
	const url = `${prefix}`;
	// 이미 등록된 리플 재업로드는 정상 분기다 (onMessage가 400을 안내 메시지로 처리).
	return httpClient.post(url, data, { expectedStatuses: [400], guildId: data?.guild?.id });
}

/**
 * @description !drop 게임 기록 삭제
 * @param {String} actorMemberId 명령 사용자 Discord id (삭제 감사 로그용)
 */
const delete_game = async(gameId, guildId, actorMemberId) => {
	const url = `/matches/${guildId}/games/${toPathSegment(gameId)}`;
	// 삭제 기한이 지난 리플은 백엔드가 409로 거절한다(정상 분기, 안내는 응답 message 그대로).
	return httpClient.delete(url, { actorMemberId }, { guildId, expectedStatuses: [409] });
}

module.exports = {
	post_replay,
	delete_game,
}

