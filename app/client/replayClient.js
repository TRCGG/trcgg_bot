const httpClient = require('../utils/networkUtils');
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
	return httpClient.post(url, data);
}

/**
 * @description !drop 게임 기록 삭제
 */
const delete_game = async(gameId, guildId) => {
	const url = `/matches/${guildId}/games/${gameId}`;
	return httpClient.delete(url);
}

module.exports = {
	post_replay,
	delete_game,
}

