const { escapeMarkdown } = require('discord.js');
const recruitStore = require('../services/recruitStore');
const recruitService = require('../services/recruitService');
const res = require('../utils/responseHandler');
const { safeReply, missingPermissions } = require('../utils/discordUtils');

/**
 * 내전 모집 명령어
 * - !내전모집 [인원] [메모] : 실행 채널에 모집 패널 게시 (서버당 동시 5개)
 * - !ㄴㅈ : !내전모집 축약
 */

const DEFAULT_CAPACITY = 10;
const MIN_CAPACITY = 2;
const MAX_CAPACITY = 40;
const MAX_MEMO_LENGTH = 100;

// 패널이나 채널을 지운 모집이 자리를 차지하고 있으면 12시간 동안 서버 전체가 막힌다.
const pruneDeletedPanels = async (client, active) => {
	let pruned = 0;
	for (const recruit of active) {
		if (!(await recruitService.panelExists(client, recruit))) {
			recruitService.dropRecruit(recruit);
			pruned++;
		}
	}
	return pruned;
};

// 낮 12시를 넘기면 같은 차수가 둘 생길 수 있어 차수만으로는 구분이 안 된다.
const guildLimitText = (active) => {
	const lines = active
		.slice()
		.sort((a, b) => a.createdAt - b.createdAt)
		.map((r) => {
			const link = r.messageId ? ` — ${recruitService.panelUrl(r)}` : '';
			return `• ${r.round}차 · <#${r.channelId}> · ${escapeMarkdown(r.hostName)}${link}`;
		});
	return (
		`⚠️ 내전 모집은 서버에서 동시에 최대 ${recruitStore.MAX_PER_GUILD}개까지 열 수 있습니다.\n` +
		'진행 중인 모집을 종료한 뒤 다시 열어주세요. (개설 12시간 뒤 자동 종료)\n' +
		lines.join('\n')
	);
};

const postFailedText = (channel) => {
	const missing = missingPermissions(channel, { embeds: [{}] });
	return missing.length > 0
		? `⚠️ 이 채널에 모집 패널을 올릴 수 없습니다. 봇 권한을 확인해주세요: ${missing.join(', ')}`
		: '⚠️ 모집 패널을 올리지 못했습니다. 잠시 후 다시 시도해주세요.';
};

const openRecruit = async (client, msg, args) => {
	let capacity = DEFAULT_CAPACITY;
	let memoArgs = args;
	const capacityArg = args.length > 0 ? args[0].match(/^(\d+)명?$/) : null;
	if (capacityArg) {
		capacity = Number(capacityArg[1]);
		if (capacity < MIN_CAPACITY || capacity > MAX_CAPACITY) {
			return res.error(
				msg,
				new Error(`인원은 ${MIN_CAPACITY}~${MAX_CAPACITY} 사이의 숫자로 입력해주세요.`),
			);
		}
		memoArgs = args.slice(1);
	}
	// 문자 단위로 자른다. UTF-16 단위로 자르면 이모지가 반으로 잘려 디스코드가 메시지를 거부한다.
	const memo = Array.from(memoArgs.join(' ')).slice(0, MAX_MEMO_LENGTH).join('');

	const params = {
		guildId: msg.guild.id,
		channelId: msg.channel.id,
		hostId: msg.author.id,
		hostName: msg.member?.displayName ?? msg.author.username,
		capacity,
		memo,
	};
	let result = recruitStore.open(params);
	if (result.status === 'GUILD_LIMIT' && (await pruneDeletedPanels(msg.client, result.active)) > 0) {
		result = recruitStore.open(params);
	}
	if (result.status === 'GUILD_LIMIT') return safeReply(msg, guildLimitText(result.active));
	const { recruit } = result;

	const message = await recruitService.postPanel(msg.channel, recruit);
	if (!message) {
		recruitService.dropRecruit(recruit);
		return safeReply(msg, postFailedText(msg.channel));
	}
	recruit.messageId = message.id;
	recruitService.scheduleExpiry(msg.channel, recruit);
};

module.exports = [
	{ name: '내전모집', run: openRecruit },
	{ name: 'ㄴㅈ', run: openRecruit },
];
