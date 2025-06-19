const guildClient = require('../client/guildClient');
const stringUtils = require('../utils/stringUtils');
const { AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const { createObjectCsvStringifier } = require('csv-writer');
/**
 * 길드 관련 api call service
 */

/**
 * @param {*} client 
 * @description 길드 목록 가져오기
 * @returns 
 */
const get_guild_list_data = async (client) => {
  const guilds = await client.guilds.fetch();

  const guildList = [];

  for (const [id, guildData] of guilds) {
    const guild = await guildData.fetch();
    guildList.push({
      id: guild.id,
      name: guild.name,
			lan_id: 'ko' // default ko
    });
  }

  return { guilds: guildList };
};

/**
 * @param {*} guildList 
 * @description 길드 목록 포맷팅
 * @returns 
 */
const format_guild_list = (guildList) => {
  return guildList.guilds.map(guild => `**${guild.name}** - ${guild.id}`).join('\n');
};

/**
 * @param {*} client 
 * @description 길드 목록 보여주기
 * @param {*} msg 
 */
const show_and_insert_guild_list = async (client) => {
  const guildList = await get_guild_list_data(client);
  const formattedList = format_guild_list(guildList);

	const post_guild = await guildClient.post_guild(guildList.guilds);

	return formattedList;
};

/**
 * @param {*} client 
 * @param {*} msg 
 * @description 길드 추가
 * @returns 
 */
const post_guild = async (guilds) => {
  const result = await guildClient.post_guild(guilds);
  return result;
}

/**
 * @description 길드 수정
 * @returns 
 */
const put_guild_lang = async (lang, guild_id) => {
	const data = {
		lan_id: lang,
		guild_id : guild_id
	};
	
	const result = await guildClient.put_guild_lang(data); // 길드 수정 API 호출
	let message = "";
	if(!result) {
		message =("길드 언어 설정 중 오류가 발생했습니다.");
	} else {
		message =(`길드 언어가 ${lang}로 설정되었습니다.`);
	}
  return message;
}

/**
 * @param {*} client 
 * @param {*} msg 
 * @param {*} args 
 * @description 길드 삭제
 * @returns 
 */
const delete_guild = async (client, msg, args) => {
	const guild_id = args[0];
	if (!guild_id) {
		msg.reply("길드 ID를 입력하세요.");
		return;
	}
	const guild = client.guilds.cache.get(guild_id);
  try {
		await guild.leave();
		msg.reply(`길드 ${guild.name}에서 떠났습니다.`);

		const encode_guild_id = stringUtils.encodeGuildId(guild_id); // 길드 ID 가져오기
		
		await guildClient.delete_guild(encode_guild_id); // 길드 삭제 API 호출
	} catch (error) {
		console.error("Error leaving guild:", error);
		msg.reply("길드를 떠나는 중 오류가 발생했습니다.");
	}
}

/**
 * @param {*} client
 * @param {*} msg
 * @param {*} args
 * @description 길드 멤버 목록을 액셀 파일로 보여줍니다.
 */
const show_guild_member_list = async (client, msg, args) => {
	const guild = msg.guild;

	await guild.members.fetch(); // 모든 멤버 캐싱

	const members = guild.members.cache.filter(member => !member.user.bot);

	const csvStringifier  = createObjectCsvStringifier ({
		path: 'members.csv',
		header: [
			{ id: 'username', title: 'Username' },
			// { id: 'tag', title: 'Tag' },
			// { id: 'id', title: 'User ID' },
			{ id: 'nickname', title: 'Nickname' },
      { id: 'joinedAt', title: '가입일' }
		]
	});

	const records = members.map(member => {
		const joinedAtKST = member.joinedAt
			? new Date(member.joinedAt.getTime() + 9 * 60 * 60 * 1000) // UTC → KST
					.toISOString()
					.replace('T', ' ')
					.slice(0, 19)
			: '';

		return {
			username: member.user.username,
			// tag: member.user.tag,
			// id: member.user.id,
			nickname: member.displayName || '',
			joinedAt: joinedAtKST
		};
	});
	const csvContent = '\uFEFF' + csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);

	// Buffer로 만들기
	const buffer = Buffer.from(csvContent, 'utf8');

	// AttachmentBuilder에 바로 넣기
	const attachment = new AttachmentBuilder(buffer, { name: 'members.csv' });
	await msg.channel.send({
		content: `멤버 목록 (${records.length}명):`,
		files: [attachment]
	});

}

module.exports = {
	show_and_insert_guild_list,
	show_guild_member_list,
	post_guild,
	put_guild_lang,
	delete_guild,
};


