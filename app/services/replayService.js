const replayClient = require('../client/replayClient');
const stringUtils = require('../utils/stringUtils');

/**
 * 리플레이 api call
 */

/**
 * @param {String} file_url
 * @param {String} file_name
 * @param {String} create_user
 * @param {String} guild_id
 * @description 리플레이 저장
 * @returns {String} message
 */
const save = async(file_url, file_name, create_user, guild_id) => {
	const data = {
		fileUrl : file_url,
		fileName : file_name, 
		createUser : create_user,
	}
	const resultMessage = await replayClient.post_replay(data, guild_id);
	return resultMessage;
}

/**
 * @param {String} msg
 * @param {String} args
 * @description !drop 리플 삭제
 * @returns {String} message
 */
const delete_replay = async(msg, args) => {
	const game_id = args.join(" ").trim();
	const guild_id = stringUtils.encodeGuildId(msg.guild.id);
	const resultMessage = await replayClient.delete_replay(game_id, guild_id);
	return resultMessage;
}

module.exports = {
	save,
	delete_replay,
}

