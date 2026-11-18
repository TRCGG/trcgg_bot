const guildClient = require('../client/guildClient');
const stringUtils = require('../utils/stringUtils');
const { AttachmentBuilder, escapeMarkdown } = require('discord.js');
const { createObjectCsvStringifier } = require('csv-writer');
const { safeReply, safeSend, DiscordCode } = require('../utils/discordUtils');
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

const KST_FORMAT = new Intl.DateTimeFormat('sv-SE', {
	timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
	hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
const to_kst = (date) => KST_FORMAT.format(date);

const guild_alert = (guild, { icon, text }) => {
	const name = guild.name ? escapeMarkdown(guild.name) : '(이용 불가)';
	return `\`${to_kst(new Date()).slice(5)}\` ${icon} **${name}** ${text} · ${guild.memberCount ?? '?'}명 · ${guild.id}`;
};

// 길드 이름에 @everyone 같은 문자열이 들어갈 수 있어 멘션을 전부 막는다.
const notify = async (client, content) => {
	const channelId = process.env.GUILD_NOTIFY_CHANNEL_ID;
	if (!channelId) return false;
	return safeSend(client.channels.cache.get(channelId), { content, allowedMentions: { parse: [] } });
};

// 미인증 봇은 서버 100개까지만 들어갈 수 있어, 서버를 계속 만들어 초대하면 한도가 찬다.
const MAX_GUILDS_PER_OWNER = 2;
const MIN_MEMBERS_TO_REGISTER = 5;

// 자동 퇴장도 GuildDelete를 일으킨다. 퇴장 알림이 한 번 더 나가지 않게 표시해 둔다.
const auto_left = new Set();

const exceeds_owner_limit = (client, guild) => {
	if (!guild.ownerId || guild.ownerId === process.env.ADMIN_ID) return false;
	const owned = [...client.guilds.cache.values()]
		.filter((other) => other.id !== guild.id && other.ownerId === guild.ownerId);
	return owned.length >= MAX_GUILDS_PER_OWNER;
};

// httpClient가 상태코드를 버려 POST 응답만으로는 신규/기존을 구분할 수 없다.
const register_joined_guild = async (guild) => {
	const existing = await guildClient.get_guild(guild.id);
	if (existing) {
		const registered = existing.createDate ? ` (등록 ${to_kst(new Date(existing.createDate)).slice(0, 10)})` : '';
		return { icon: '⚪', text: `다시 초대${registered}` };
	}
	if ((guild.memberCount ?? MIN_MEMBERS_TO_REGISTER) < MIN_MEMBERS_TO_REGISTER) {
		return { icon: '⏸️', text: `등록 보류 (멤버 ${MIN_MEMBERS_TO_REGISTER}명 미만, 첫 리플 업로드 때 등록)` };
	}
	const saved = await guildClient.create_guild(guild.id, guild.name);
	return saved?.isDeleted
		? { icon: '🟡', text: '삭제된 길드 재초대' }
		: { icon: '🟢', text: '신규 등록' };
};

const on_guild_join = async (client, guild) => {
	// 자동 퇴장 뒤 GuildDelete를 놓치면 표시가 남아 나중의 진짜 퇴장 알림을 삼킨다. 다시 초대되면 지운다.
	auto_left.delete(guild.id);

	if (exceeds_owner_limit(client, guild)) {
		auto_left.add(guild.id);
		try {
			await guild.leave();
		} catch (error) {
			// 요청은 처리되고 응답만 끊기면 재시도가 Unknown Guild로 실패한다. 이때는 실제로 나간 것이다.
			if (error?.code !== DiscordCode.UNKNOWN_GUILD && client.guilds.cache.has(guild.id)) {
				auto_left.delete(guild.id);
				console.error('[guildCreate] 자동 퇴장 실패:', error);
				await notify(client, guild_alert(guild, { icon: '❌', text: '자동 퇴장 실패 (같은 소유자 서버 초과, `!길드떠나기`로 내보내세요)' }));
				return;
			}
		}
		await notify(client, guild_alert(guild, { icon: '🚫', text: `자동 퇴장 (같은 소유자 서버가 이미 ${MAX_GUILDS_PER_OWNER}개)` }));
		return;
	}

	let status;
	try {
		status = await register_joined_guild(guild);
	} catch (error) {
		// BotError는 networkUtils가 이미 남겼다.
		if (!(error instanceof BotError)) console.error('[guildCreate] 길드 등록 실패:', error);
		status = { icon: '❌', text: '등록 실패 (첫 리플 업로드 때 재시도)' };
	}
	await notify(client, guild_alert(guild, status));
};

const on_guild_leave = async (client, guild) => {
	if (auto_left.delete(guild.id)) return;
	await notify(client, guild_alert(guild, { icon: '🔴', text: '나감' }));
};

module.exports = {
	get_guilds_list,
	on_guild_join,
	on_guild_leave,
	show_guild_list,
	show_guild_member_list,
	leave_discord_guild,
};


