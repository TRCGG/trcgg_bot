const guildClient = require('../client/guildClient');
const stringUtils = require('../utils/stringUtils');
const { AttachmentBuilder } = require('discord.js');
const { createObjectCsvStringifier } = require('csv-writer');
/**
 * 길드 관련 api call service
 */

/**
 * @description 내전봇이 디스코드에 등록되어 있는 길드 목록 가져오기
 */
const get_discord_guild_list_data = async (client) => {
  const guilds = await client.guilds.fetch();

  const guildList = [];

  for (const [id, guildData] of guilds) {
    const guild = await guildData.fetch();
    guildList.push({
      id: guild.id,
      name: guild.name,
    });
  }

  return { guilds: guildList };
};

/**
 * @description 길드 목록 포맷팅
 */
const format_guild_list = (guildList) => {
  return guildList.guilds.map(guild => `**${guild.name}** - ${guild.id}`).join('\n');
};

/**
 * @param {*} client 
 * @description 내전봇이 있는 디스코드 길드 목록 보여주기
 * @param {*} msg 
 */
const show_guild_list = async (client) => {
  const guildList = await get_discord_guild_list_data(client);
  const formattedList = format_guild_list(guildList);
	return formattedList;
};

/**
 * @desc DB에 저장되어있는 길드 목록
 */
const get_guilds_list = async (client) => {
	const guilds = await guildClient.get_guilds();
	const description = guilds.map((guild) => {
    const date = new Date(guild.createDate).toISOString().split('T')[0];
    const status = guild.isDeleted ? "❌" : "✅";
    
    return `${guild.name} (\`${guild.id}\`)\n${date} ${status}`;
  }).join('\n\n'); // 항목 간 줄바꿈

  return stringUtils.createEmbed({
    title: `DB 길드 목록 (총 ${guilds.length}개)`,
    description: description,
    color: 0x00ff00,
  });
}

/**
 * @description 디스코드 길드 떠나기
 */
const leave_discord_guild = async (client, msg, args) => {
	const guild_id = args[0];
	if (!guild_id) {
		msg.reply("길드 ID를 입력하세요.");
		return;
	}
	const guild = client.guilds.cache.get(guild_id);
  try {
		await guild.leave();
		msg.reply(`길드 ${guild.name}에서 떠났습니다.`);
		
	} catch (error) {
		console.error("Error leaving guild:", error);
		msg.reply("길드를 떠나는 중 오류가 발생했습니다.");
	}
}

/**
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
	get_guilds_list,
	show_guild_list,
	show_guild_member_list,
	leave_discord_guild,
};


