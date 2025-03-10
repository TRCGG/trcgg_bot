const httpClient = require('../utils/networkUtils');
const prefix = '/replay';

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
const post_replay = async(data, guild_id) => {
	const url = `${prefix}/${guild_id}`;
	return httpClient.post(url, data);
}

/**
 * @param {String} game_id
 * @param {String} guild_id
 * @description !drop 리플 삭제
 * @returns {String} message
 */
const delete_replay = async(game_id, guild_id) => {
	const url = `${prefix}/${game_id}/${guild_id}`;
	return httpClient.delete(url);
}

module.exports = {
	post_replay,
	delete_replay,
}

