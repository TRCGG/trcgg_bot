const {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	MessageFlags,
	StringSelectMenuBuilder,
	escapeMarkdown,
} = require('discord.js');
const recruitStore = require('./recruitStore');
const stringUtils = require('../utils/stringUtils');
const { canSend, safeSend, DiscordCode } = require('../utils/discordUtils');

const PREFIX = 'recruit';
const COLOR = { open: 0x57f287, closed: 0xfee75c, ended: 0x95a5a6 };
const FIELD_LIMIT = 1024;
const MESSAGE_LIMIT = 2000;
const SELECT_OPTIONS_MAX = 25;
const SELECT_ROWS_MAX = 4; // 메시지당 액션 로우 5줄 중 1줄은 마감·종료 버튼

const STALE_TEXT =
	'⚠️ 이미 종료됐거나 봇 재시작으로 사라진 모집입니다. `!내전모집`으로 다시 열어주세요.';

const customId = (action, recruit, suffix) =>
	[PREFIX, action, recruit.id, suffix].filter((v) => v !== undefined).join(':');

const panelUrl = (recruit) =>
	`https://discord.com/channels/${recruit.guildId}/${recruit.channelId}/${recruit.messageId}`;

const numberedLines = (members, offset = 0) =>
	members.map((m, i) => `${offset + i + 1}. ${escapeMarkdown(m.name)}`);

// escapeMarkdown이 길이를 늘려서 정원 40·긴 닉네임이면 필드 한도를 넘는다.
// 넘으면 edit가 50035로 실패하고 그 뒤 모든 클릭이 같은 이유로 실패한다.
const fitLines = (lines, limit = FIELD_LIMIT) => {
	const kept = [];
	let length = 0;
	for (let i = 0; i < lines.length; i++) {
		const rest = lines.length - i - 1;
		const suffix = rest > 0 ? `\n…외 ${rest}명` : '';
		const next = length + (kept.length > 0 ? 1 : 0) + lines[i].length;
		if (next + suffix.length > limit) {
			return `${kept.join('\n')}\n…외 ${lines.length - i}명`;
		}
		kept.push(lines[i]);
		length = next;
	}
	return kept.join('\n');
};

// 인라인 필드는 모바일에서 세로로 쌓이므로 1~5 / 6~10처럼 열 단위로 나눠야 순서가 유지된다.
const participantFields = (participants) => {
	if (participants.length === 0) return [{ name: '참가 명단', value: '(없음)' }];
	const half = Math.ceil(participants.length / 2);
	const fields = [
		{ name: '참가 명단', value: fitLines(numberedLines(participants.slice(0, half))), inline: true },
	];
	if (participants.length > half) {
		fields.push({ name: '​', value: fitLines(numberedLines(participants.slice(half), half)), inline: true });
	}
	return fields;
};

const waitlistValue = (waitlist) =>
	waitlist.length === 0 ? '(없음)' : fitLines(numberedLines(waitlist));

const buildTitle = (recruit, ended) => {
	const count = `${recruit.participants.length}/${recruit.capacity}`;
	if (ended) return `✅ ${recruit.round}차 내전 모집 종료 (${count})`;
	const waiting = recruit.waitlist.length > 0 ? ` · 대기 ${recruit.waitlist.length}` : '';
	return `${recruit.closed ? '🔒 ' : ''}⚔️ ${recruit.round}차 내전 모집 (${count}${waiting})`;
};

const buildPanel = (recruit, { ended = false } = {}) => {
	const description = [`개최자: ${escapeMarkdown(recruit.hostName)}`];
	if (recruit.memo) description.push(`📝 ${escapeMarkdown(recruit.memo)}`);

	let color = COLOR.open;
	if (ended) color = COLOR.ended;
	else if (recruit.closed) color = COLOR.closed;

	const embed = new EmbedBuilder()
		.setColor(color)
		.setTitle(buildTitle(recruit, ended))
		.setDescription(description.join(' · '))
		.addFields(
			...participantFields(recruit.participants),
			{ name: '대기 명단', value: waitlistValue(recruit.waitlist) },
		)
		.setFooter({ text: ended ? '종료된 모집' : '개설 후 12시간이 지나면 자동 만료' })
		.setTimestamp(recruit.createdAt);

	if (ended) return { embeds: [embed], components: [] };

	const row = new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setCustomId(customId('join', recruit))
			.setLabel('참가')
			.setEmoji('✋')
			.setStyle(ButtonStyle.Success)
			.setDisabled(recruit.closed),
		new ButtonBuilder().setCustomId(customId('leave', recruit)).setLabel('취소').setStyle(ButtonStyle.Secondary),
		new ButtonBuilder()
			.setCustomId(customId('copy', recruit))
			.setLabel('명단 복사')
			.setEmoji('📋')
			.setStyle(ButtonStyle.Primary),
		new ButtonBuilder()
			.setCustomId(customId('manage', recruit))
			.setLabel('관리')
			.setEmoji('⚙️')
			.setStyle(ButtonStyle.Secondary),
	);
	return { embeds: [embed], components: [row] };
};

const buildManageView = (recruit, notice) => {
	const members = [
		...recruit.participants.map((m, i) => ({ ...m, label: `참가 ${i + 1}. ${m.name}` })),
		...recruit.waitlist.map((m, i) => ({ ...m, label: `대기 ${i + 1}. ${m.name}` })),
	];
	const selectable = members.slice(0, SELECT_OPTIONS_MAX * SELECT_ROWS_MAX);

	const components = [];
	for (let start = 0; start < selectable.length; start += SELECT_OPTIONS_MAX) {
		const chunk = selectable.slice(start, start + SELECT_OPTIONS_MAX);
		const range = selectable.length > SELECT_OPTIONS_MAX ? ` (${start + 1}~${start + chunk.length})` : '';
		components.push(
			new ActionRowBuilder().addComponents(
				new StringSelectMenuBuilder()
					.setCustomId(customId('kick', recruit, components.length))
					.setPlaceholder(`추방할 인원 선택${range}`)
					.setMinValues(1)
					.setMaxValues(chunk.length)
					.addOptions(chunk.map((m) => ({ label: m.label.slice(0, 100), value: m.userId }))),
			),
		);
	}
	components.push(
		new ActionRowBuilder().addComponents(
			recruit.closed
				? new ButtonBuilder().setCustomId(customId('reopen', recruit)).setLabel('재개').setEmoji('🔓').setStyle(ButtonStyle.Success)
				: new ButtonBuilder().setCustomId(customId('close', recruit)).setLabel('마감').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
			new ButtonBuilder().setCustomId(customId('end', recruit)).setLabel('종료').setEmoji('🛑').setStyle(ButtonStyle.Danger),
		),
	);

	const lines = [];
	if (notice) lines.push(notice);
	lines.push(`⚙️ **${recruit.round}차 모집 관리** (${recruit.participants.length}/${recruit.capacity}${recruit.closed ? ' · 마감' : ''})`);
	if (members.length > selectable.length) {
		lines.push(`ℹ️ 앞 ${selectable.length}명까지만 추방 목록에 표시됩니다.`);
	}
	return { content: lines.join('\n'), components };
};

const ephemeral = (content) => ({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });

const memberName = (interaction) => interaction.member?.displayName ?? interaction.user.username;

const nameList = (members) => members.map((m) => escapeMarkdown(m.name)).join(', ');

const canManage = (recruit, interaction) =>
	recruit.hostId === interaction.user.id || stringUtils.checkAuth(interaction);

const GONE_CODES = new Set([DiscordCode.UNKNOWN_MESSAGE, DiscordCode.UNKNOWN_CHANNEL]);
const isGone = (error) => GONE_CODES.has(error?.code);

/**
 * @returns {Promise<boolean>} 패널 메시지가 남아 있는지. 확인할 수 없으면 남아 있다고 본다.
 */
const panelExists = async (client, recruit) => {
	if (!recruit.messageId) return true; // 게시 중
	try {
		const channel = await client.channels.fetch(recruit.channelId);
		await channel.messages.fetch(recruit.messageId);
		return true;
	} catch (error) {
		return !isGone(error);
	}
};

/**
 * @returns {Promise<import('discord.js').Message|null>} 게시한 메시지. 실패 시 null, 예외를 던지지 않는다.
 */
const postPanel = async (channel, recruit) => {
	const payload = buildPanel(recruit);
	if (!canSend(channel, payload)) {
		console.warn('[recruit] 패널 게시 불가', { guild: channel?.guild?.id, channel: channel?.id });
		return null;
	}
	try {
		return await channel.send(payload);
	} catch (error) {
		console.warn('[recruit] 패널 게시 실패', { guild: channel?.guild?.id, channel: channel?.id, code: error?.code });
		return null;
	}
};

const renderState = new WeakMap(); // recruit → { chain, queued, expiryTimer }

const stateOf = (recruit) => {
	let state = renderState.get(recruit);
	if (!state) {
		state = { chain: Promise.resolve(), queued: false, expiryTimer: null };
		renderState.set(recruit, state);
	}
	return state;
};

// 타이머를 남기면 끝난 모집과 채널 객체가 12시간 동안 메모리에 잡혀 있다.
const dropRecruit = (recruit) => {
	clearTimeout(stateOf(recruit).expiryTimer);
	recruitStore.end(recruit);
};

/**
 * 패널 edit를 모집별로 직렬화하고, 실행 시점의 최신 상태로 그린다.
 * 인터랙션 응답에 payload를 실어 보내면 동시 클릭 시 늦게 도착한 옛 상태가 패널을 덮어쓰고,
 * 종료된 패널이 다시 열린 모양으로 돌아간다. reject하지 않는다.
 */
const renderPanel = (channel, recruit) => {
	const state = stateOf(recruit);
	if (state.queued) return state.chain;
	state.queued = true;
	state.chain = state.chain.then(async () => {
		state.queued = false;
		const ended = recruitStore.find(recruit.channelId, recruit.id) !== recruit;
		try {
			await channel.messages.edit(recruit.messageId, buildPanel(recruit, { ended }));
		} catch (error) {
			// 패널이나 채널이 지워졌으면 모집도 끝낸다. 남겨두면 12시간 동안 서버 모집 자리 하나를 차지한다.
			if (isGone(error)) dropRecruit(recruit);
			console.warn('[recruit] 패널 갱신 실패', { channel: recruit.channelId, code: error?.code });
		}
	});
	return state.chain;
};

const scheduleExpiry = (channel, recruit) => {
	const remaining = recruit.createdAt + recruitStore.EXPIRE_MS - Date.now();
	const timer = setTimeout(() => {
		dropRecruit(recruit);
		renderPanel(channel, recruit);
	}, Math.max(remaining, 0));
	// 봇은 게이트웨이 연결로 살아 있으므로 영향이 없고, 테스트 프로세스가 12시간 동안 안 끝나는 것을 막는다.
	timer.unref?.();
	stateOf(recruit).expiryTimer = timer;
};

const resolveChannel = async (interaction) =>
	interaction.channel ?? interaction.client.channels.fetch(interaction.channelId);

// 한 번에 많은 DM 채널을 열면 디스코드 스팸 감지에 걸릴 수 있다. 넘으면 채널 멘션으로만 알린다.
const DM_MAX = 5;

/**
 * 예외를 던지지 않는다.
 */
const notifyPromoted = async (interaction, channel, recruit, promoted) => {
	if (promoted.length === 0) return;
	let unreachable = promoted;
	if (promoted.length <= DM_MAX) {
		const where = interaction.guild?.name ? `**${escapeMarkdown(interaction.guild.name)}** ` : '';
		const dmText =
			`⬆️ ${where}${recruit.round}차 내전 모집에서 대기 → 참가로 올라갔습니다.\n${panelUrl(recruit)}`;
		const results = await Promise.allSettled(
			promoted.map((m) => interaction.client.users.send(m.userId, dmText)),
		);
		unreachable = promoted.filter((_, i) => results[i].status === 'rejected');
	}
	if (unreachable.length === 0) return;

	await safeSend(channel, {
		content:
			`${unreachable.map((m) => `<@${m.userId}>`).join(' ')} ` +
			`⬆️ ${recruit.round}차 내전 대기에서 참가로 올라갔습니다.`,
		allowedMentions: { users: unreachable.map((m) => m.userId) },
	});
};

/**
 * 개최자·관리자가 마음대로 뺄 수 있으므로 누가 누구를 뺐는지 채널에 공개로 남긴다.
 * 예외를 던지지 않는다.
 */
const announceKick = async (interaction, channel, recruit, kicked) => {
	if (kicked.length === 0) return;
	const role = recruit.hostId === interaction.user.id ? '개최자' : '관리자';
	await safeSend(channel, {
		content:
			`🚫 [${recruit.round}차 내전] ${role} ${escapeMarkdown(memberName(interaction))}님이 ` +
			`${nameList(kicked)}님을 추방했습니다.`,
		allowedMentions: { parse: [] },
	});
};

/**
 * 상태를 바꾼 직후, 응답보다 먼저 시작한다. 응답이 실패(10062 등)해도 패널과 알림은 반영돼야 한다.
 * reject하지 않는다.
 */
const syncAfterChange = (interaction, recruit, { promoted = [], kicked = [] } = {}) =>
	resolveChannel(interaction)
		.then((channel) =>
			Promise.all([
				renderPanel(channel, recruit),
				// 추방 기록이 승급 멘션보다 먼저 보여야 흐름이 읽힌다.
				announceKick(interaction, channel, recruit, kicked).then(() =>
					notifyPromoted(interaction, channel, recruit, promoted),
				),
			]),
		)
		.catch((error) => {
			console.warn('[recruit] 패널 갱신·알림 실패', {
				channel: recruit.channelId, code: error?.code, message: error?.message,
			});
		});

const disablePanel = (message) =>
	message.components.map((row) =>
		new ActionRowBuilder().addComponents(row.components.map((c) => ButtonBuilder.from(c).setDisabled(true))),
	);

const PANEL_ACTIONS = new Set(['join', 'leave', 'copy', 'manage']);

const handleStale = async (interaction, action) => {
	if (PANEL_ACTIONS.has(action)) {
		await interaction.update({ components: disablePanel(interaction.message) });
		await interaction.followUp(ephemeral(STALE_TEXT));
		return;
	}
	await interaction.update({ content: STALE_TEXT, components: [] });
};

const onJoin = async (interaction, recruit) => {
	const result = recruitStore.join(recruit, { userId: interaction.user.id, name: memberName(interaction) });
	if (result.status === 'ALREADY_IN') return interaction.reply(ephemeral('ℹ️ 이미 참가 중입니다.'));
	if (result.status === 'CLOSED') return interaction.reply(ephemeral('🔒 마감된 모집입니다.'));

	const sync = syncAfterChange(interaction, recruit);
	const text =
		result.status === 'JOINED'
			? `✅ 참가했습니다. (${recruit.participants.length}/${recruit.capacity})`
			: `🕒 정원이 차서 대기 ${result.position}번으로 등록했습니다.`;
	try {
		await interaction.reply(ephemeral(text));
	} finally {
		await sync;
	}
};

const onLeave = async (interaction, recruit) => {
	const result = recruitStore.leave(recruit, interaction.user.id);
	if (result.status === 'NOT_IN') return interaction.reply(ephemeral('ℹ️ 참가 중이 아닙니다.'));

	const sync = syncAfterChange(interaction, recruit, { promoted: result.promoted });
	try {
		await interaction.reply(ephemeral('👋 취소했습니다.'));
	} finally {
		await sync;
	}
};

const onCopy = async (interaction, recruit) => {
	if (recruit.participants.length === 0) return interaction.reply(ephemeral('ℹ️ 아직 참가자가 없습니다.'));
	const roster =
		`📋 ${recruit.round}차 참가 명단 (${recruit.participants.length}명)\n` +
		`\`\`\`\n${recruitStore.formatRosterText(recruit)}\n\`\`\``;
	const mention =
		'📣 전체 멘션 (복사해서 채팅에 붙여넣기)\n' +
		`\`\`\`\n${recruitStore.formatMentionText(recruit)}\n\`\`\``;
	const combined = `${roster}\n${mention}`;

	if (combined.length <= MESSAGE_LIMIT) {
		await interaction.reply(ephemeral(combined));
		return;
	}
	await interaction.reply(ephemeral(roster));
	await interaction.followUp(ephemeral(mention));
};

const onManage = (interaction, recruit) =>
	interaction.reply({ ...buildManageView(recruit), flags: MessageFlags.Ephemeral });

const onKick = async (interaction, recruit) => {
	const { removed, promoted } = recruitStore.kick(recruit, interaction.values);
	const sync = syncAfterChange(interaction, recruit, { promoted, kicked: removed });
	const notice = [];
	if (removed.length > 0) notice.push(`🚫 추방: ${nameList(removed)}`);
	if (promoted.length > 0) notice.push(`⬆️ 대기 → 참가: ${nameList(promoted)}`);
	try {
		await interaction.update(buildManageView(recruit, notice.join('\n') || 'ℹ️ 이미 나간 인원입니다.'));
	} finally {
		await sync;
	}
};

const onSetClosed = (closed) => async (interaction, recruit) => {
	recruitStore.setClosed(recruit, closed);
	const sync = syncAfterChange(interaction, recruit);
	try {
		await interaction.update(buildManageView(recruit, closed ? '🔒 마감했습니다.' : '🔓 다시 열었습니다.'));
	} finally {
		await sync;
	}
};

const onEnd = async (interaction, recruit) => {
	dropRecruit(recruit);
	const sync = syncAfterChange(interaction, recruit);
	try {
		await interaction.update({ content: '🛑 모집을 종료했습니다.', components: [] });
	} finally {
		await sync;
	}
};

const HANDLERS = {
	join: { run: onJoin },
	leave: { run: onLeave },
	copy: { run: onCopy },
	manage: { run: onManage, manage: true },
	kick: { run: onKick, manage: true },
	close: { run: onSetClosed(true), manage: true },
	reopen: { run: onSetClosed(false), manage: true },
	end: { run: onEnd, manage: true },
};

/**
 * @returns {Promise<boolean>} 처리했으면 true, 아니면 false
 */
const handleRecruitInteraction = async (interaction) => {
	if (!interaction.isButton() && !interaction.isStringSelectMenu()) return false;
	const [prefix, action, recruitId] = interaction.customId.split(':');
	if (prefix !== PREFIX) return false;

	try {
		const handler = HANDLERS[action];
		const recruit = recruitStore.find(interaction.channelId, recruitId);
		if (!handler || !recruit) {
			await handleStale(interaction, action);
		} else if (handler.manage && !canManage(recruit, interaction)) {
			await interaction.reply(ephemeral('⛔ 개최자 또는 관리자만 관리할 수 있습니다.'));
		} else {
			await handler.run(interaction, recruit);
		}
	} catch (error) {
		console.warn('[recruit] 인터랙션 처리 실패', {
			guild: interaction.guildId, channel: interaction.channelId, action, code: error?.code, message: error?.message,
		});
		// 3초 제한(10062)을 넘겼으면 응답할 수단이 없다. 응답 전에 실패한 경우만 알린다.
		if (!interaction.replied && !interaction.deferred) {
			await interaction.reply(ephemeral('⚠️ 처리 중 오류가 발생했습니다.')).catch(() => {});
		}
	}
	return true;
};

module.exports = {
	buildPanel,
	buildManageView,
	dropRecruit,
	panelExists,
	panelUrl,
	postPanel,
	scheduleExpiry,
	handleRecruitInteraction,
};
