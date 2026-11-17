const guildClient = require('../client/guildClient');
const stringUtils = require('../utils/stringUtils');
const { AttachmentBuilder, escapeMarkdown } = require('discord.js');
const { createObjectCsvStringifier } = require('csv-writer');
const { safeReply, safeSend } = require('../utils/discordUtils');
const { BotError } = require('../utils/errors');

const EMBED_DESCRIPTION_LIMIT = 4096;
const MESSAGE_CONTENT_LIMIT = 2000;
/**
 * 길드 관련 api call service
 */

// Guilds 인텐트라 봇이 들어가 있는 길드는 전부 캐시에 있다. 다만 재시작 직후나 디스코드 장애로
// 이용 불가인 길드는 GUILD_CREATE가 오기 전까지 name이 비어 있다.
const show_guild_list = (client) => {
	const guilds = [...client.guilds.cache.values()];
	const list = guilds.map((guild) => `**${guild.name ?? '(이용 불가)'}** - ${guild.id}`).join('\n');

	return list.length > MESSAGE_CONTENT_LIMIT
		? `봇이 들어가 있는 길드: 총 ${guilds.length}개 (목록이 길어 개수만 표시합니다.)`
		: list;
};

/**
 * @desc DB에 저장되어있는 길드 목록
 */
const get_guilds_list = async (client) => {
	const guilds = await guildClient.get_guilds();
	const renamed = await sync_guild_names(client, guilds);

	const description = guilds.map((guild) => {
    const date = new Date(guild.createDate).toISOString().split('T')[0];
    const status = guild.isDeleted ? "❌" : "✅";
    const oldName = renamed.get(guild.id);
    const nameLine = oldName ? `${guild.name} 🔄 (이전: ${oldName})` : guild.name;

    return `${nameLine} (\`${guild.id}\`)\n${date} ${status}`;
  }).join('\n\n'); // 항목 간 줄바꿈

  return stringUtils.createEmbed({
    title: `DB 길드 목록 (총 ${guilds.length}개)`,
    description: description.length > EMBED_DESCRIPTION_LIMIT
      ? '목록이 길어 개수만 표시합니다.'
      : description,
    color: 0x00ff00,
    footer: renamed.size ? { text: `이름 갱신 ${renamed.size}건` } : null,
  });
}

// guilds의 name을 제자리에서 바꾼다.
const sync_guild_names = async (client, guilds) => {
	const renamed = new Map();
	// 봇이 나간 길드는 캐시에 없어 비교 대상이 아니다. 캐시는 GUILD_UPDATE로 최신 이름을 유지한다.
	const targets = guilds.filter((guild) => {
		const current = client.guilds.cache.get(guild.id)?.name;
		return current && current !== guild.name;
	});

	await Promise.all(targets.map(async (guild) => {
		const current = client.guilds.cache.get(guild.id).name;
		try {
			const updated = await guildClient.update_guild_name(guild.id, current);
			// 백엔드가 guildName을 무시하고도 200을 주던 적이 있다. 반환된 행으로 실제 반영을 확인한다.
			if (updated?.name !== current) return;
			renamed.set(guild.id, guild.name);
			guild.name = current;
		} catch {
			// 실패 로그는 networkUtils가 남긴다. 목록은 DB 이름 그대로 보여준다.
		}
	}));

	return renamed;
};

/**
 * @description 디스코드 길드 떠나기
 */
const leave_discord_guild = async (client, msg, args) => {
	const guild_id = args[0];
	if (!guild_id) {
		await safeReply(msg, "길드 ID를 입력하세요.");
		return;
	}
	const guild = client.guilds.cache.get(guild_id);
	if (!guild) {
		await safeReply(msg, `봇이 들어가 있지 않은 길드입니다: \`${guild_id}\`\n\`!디스코드길드목록\`에서 ID를 확인하세요.`);
		return;
	}
  try {
		await guild.leave();
		await safeReply(msg, `길드 ${guild.name}에서 떠났습니다.`);

	} catch (error) {
		console.error("Error leaving guild:", error);
		await safeReply(msg, "길드를 떠나는 중 오류가 발생했습니다.");
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
	const sent = await safeSend(msg.channel, {
		content: `멤버 목록 (${records.length}명):`,
		files: [attachment]
	});

	// 파일 전송은 AttachFiles까지 필요해 실패할 수 있다. 조용히 사라지지 않게 알린다.
	if (!sent) {
		await safeReply(msg, ':warning: 멤버 목록 파일을 보내지 못했습니다. 봇의 채널 권한(파일 첨부)을 확인해주세요.');
	}

}

const guild_line = (guild) => `**${guild.name ? escapeMarkdown(guild.name) : '(이용 불가)'}** - ${guild.id} (${guild.memberCount ?? '?'}명)`;

// 길드 이름에 @everyone 같은 문자열이 들어갈 수 있어 멘션을 전부 막는다.
const notify = async (client, content) => {
	const channelId = process.env.GUILD_NOTIFY_CHANNEL_ID;
	if (!channelId) return false;
	return safeSend(client.channels.cache.get(channelId), { content, allowedMentions: { parse: [] } });
};

// httpClient가 상태코드를 버려 POST 응답만으로는 신규/기존을 구분할 수 없다.
const register_joined_guild = async (guild) => {
	if (await guildClient.get_guild(guild.id)) return 'existing';
	const saved = await guildClient.create_guild(guild.id, guild.name);
	return saved?.isDeleted ? 'deleted' : 'created';
};

const REGISTER_STATUS = {
	created: '✅ 길드 신규 등록',
	existing: '☑️ 이미 등록된 길드',
	deleted: '⚠️ 삭제 처리된 길드라 웹에 보이지 않습니다. 필요하면 관리자가 복구하세요.',
};

const on_guild_join = async (client, guild) => {
	let status;
	try {
		status = REGISTER_STATUS[await register_joined_guild(guild)];
	} catch (error) {
		// BotError는 networkUtils가 이미 남겼다.
		if (!(error instanceof BotError)) console.error('[guildCreate] 길드 등록 실패:', error);
		status = '❌ 길드 등록 실패 — 첫 리플 업로드 때 다시 등록됩니다.';
	}
	await notify(client, `📥 봇이 서버에 초대됨\n${guild_line(guild)}\n${status}`);
};

const on_guild_leave = async (client, guild) => {
	await notify(client, `📤 봇이 서버에서 나감\n${guild_line(guild)}`);
};

module.exports = {
	get_guilds_list,
	on_guild_join,
	on_guild_leave,
	show_guild_list,
	show_guild_member_list,
	leave_discord_guild,
};


