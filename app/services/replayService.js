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
	if(!game_id){	
		throw new Error("Game Id를 입력해주세요. (ex: RPY-20260205-xxxxxx-001)");
	}
	const guild_id = stringUtils.encodeGuildId(msg.guild.id);
	// 명령 사용자 id를 함께 보내 백엔드 삭제 감사 로그(guild_audit_log)에 남긴다
	const result = await replayClient.delete_game(game_id, guild_id, msg.author.id);
	return result;
}

module.exports = {
	save,
	delete_replay,
}

