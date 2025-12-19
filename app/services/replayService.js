const replayClient = require('../client/replayClient');
const stringUtils = require('../utils/stringUtils');

/**
 * 리플레이 api call
 */

/**
 * @description 리플레이 저장
 */
const save = async(fileUrl, fileName, createUser, guildId, gameType, guildName) => {
	const data = {
		fileName : fileName, 
		fileUrl : fileUrl,
		gameType : gameType,
		createUser : createUser,
		guild : {
			id: guildId,
			name: guildName,
			languageCode: 'ko', // default
		}
	}
	const resultData = await replayClient.post_replay(data);
	return resultData;
}

/**
 * @description !drop 게임 기록 삭제
 */
const delete_replay = async(msg, args) => {
	const game_id = args.join(" ").trim();
	const guild_id = stringUtils.encodeGuildId(msg.guild.id);
	const result = await replayClient.delete_game(game_id, guild_id);
	return result;
}

module.exports = {
	save,
	delete_replay,
}

