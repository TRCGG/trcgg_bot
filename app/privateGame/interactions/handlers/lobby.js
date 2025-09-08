const {
  ModalBuilder, TextInputBuilder, TextInputStyle,
  ActionRowBuilder, StringSelectMenuBuilder
} = require('discord.js');

const { isValidTierInput, extractTierFromNameStrict } = require('../../utils/tierUtils');
const { buildLobbyMessage } = require('../../embeds');
const { edit, fetchRoomMessage, ensureHost, ensureEndPerm } = require('../helpers');

/** 참가 버튼 */
async function join(interaction, room) {
  if (room.participants.find(p => p.userId === interaction.user.id))
    return interaction.reply({ ephemeral: true, content: '이미 참가 중이에요.' });
  if (room.participants.length >= room.maxPlayers)
    return interaction.reply({ ephemeral: true, content: '최대 인원을 초과했어요.' });

  const nameTag = interaction.member?.displayName || interaction.user.username;
  const parsedTier = extractTierFromNameStrict(nameTag);

  if (parsedTier) {
    room.participants.push({ userId: interaction.user.id, nameTag, tierStr: parsedTier, joinedAt: new Date() });
    await interaction.reply({ ephemeral: true, content: `참가 완료! (티어: ${parsedTier})` });
    const lobbyMsg = interaction.message ?? await fetchRoomMessage(interaction, room);
    return edit(lobbyMsg, buildLobbyMessage(room));
  }

  const modal = new ModalBuilder()
    .setCustomId(`pg_tier_modal:${room.id}`)
    .setTitle('현재 티어를 입력해주세요');
  const input = new TextInputBuilder()
    .setCustomId('tier_input')
    .setLabel('형식: E4, GM500, M105 등 (알파벳+숫자)')
    .setRequired(true)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('예: E4 또는 GM500');
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return interaction.showModal(modal);
}

/** 티어 모달 제출 */
async function tierModal(interaction, room) {
  if (room.participants.find(p => p.userId === interaction.user.id))
    return interaction.reply({ ephemeral: true, content: '이미 참가 중이에요.' });
  if (room.participants.length >= room.maxPlayers)
    return interaction.reply({ ephemeral: true, content: '최대 인원을 초과했어요.' });

  const userInput = (interaction.fields.getTextInputValue('tier_input') || '').toUpperCase().trim();
  if (!isValidTierInput(userInput)) {
    return interaction.reply({
      ephemeral: true,
      content: '형식이 올바르지 않아요.\n허용 예: `E4`, `GM500`, `M105`, `B2`\n다시 **참가** 버튼을 눌러주세요.',
    });
  }
  const displayName = interaction.member?.displayName || interaction.user.username;
  room.participants.push({ userId: interaction.user.id, nameTag: displayName, tierStr: userInput, joinedAt: new Date() });

  await interaction.reply({ ephemeral: true, content: `참가 완료! (티어: ${userInput})` });
  const lobbyMsg = await fetchRoomMessage(interaction, room);
  return edit(lobbyMsg, buildLobbyMessage(room));
}

/** 취소 */
async function leave(interaction, room) {
  const me = room.participants.find(p => p.userId === interaction.user.id);
  if (!me) return interaction.reply({ ephemeral: true, content: '참가자 목록에 없어요.' });

  const result = room.removeParticipant(interaction.user.id, { reason: 'cancel' });

  const lobbyMsg = await fetchRoomMessage(interaction, room);
  if (result.ended) {
    await interaction.reply({ ephemeral: true, content: '내전이 종료되었습니다.' });
    return edit(lobbyMsg, { embeds: [], components: [], content: `\`[종료]\` ${room.title ?? ''}` });
  }

  await interaction.reply({ ephemeral: true, content: '취소되었습니다.' });
  if (result.hostChanged) {
    const nextName = result.newhostNameTag ?? '알수없음';
    await interaction.followUp({ content: `개최자가 **${nextName}**(<@${result.newHostId}>)로 변경되었습니다.`, ephemeral: true });
  }
  return edit(lobbyMsg, buildLobbyMessage(room));
}

/** 추방 버튼 → 드롭다운 */
async function expelOpen(interaction, room) {
  if (!ensureHost(interaction, room)) return;
  const options = room.participants
    .filter(p => p.userId !== room.hostId)
    .map(p => ({ label: p.nameTag ?? p.userId, value: p.userId }));
  if (!options.length) return interaction.reply({ ephemeral: true, content: '추방할 대상이 없어요.' });

  const select = new StringSelectMenuBuilder()
    .setCustomId(`pg_expel_select:${room.id}`)
    .setPlaceholder('추방할 참가자를 선택')
    .setMinValues(1).setMaxValues(1)
    .addOptions(options);
  const row = new ActionRowBuilder().addComponents(select);
  return interaction.reply({ ephemeral: true, content: '추방할 참가자를 선택하세요.', components: [row] });
}

/** 추방 실행 */
async function expelApply(interaction, room) {
  if (!ensureHost(interaction, room)) return;
  const targetId = interaction.values[0];
  const idx = room.participants.findIndex(p => p.userId === targetId);
  if (idx === -1) return interaction.reply({ ephemeral: true, content: '이미 목록에 없어요.' });

  const result = room.removeParticipant(targetId, { reason: 'ban' });
  await interaction.update({ content: '추방 처리 완료.', components: [] });

  const lobbyMsg = await fetchRoomMessage(interaction, room);
  if (result.ended) {
    return edit(lobbyMsg, { embeds: [], components: [], content: '`[종료]`' });
  }
  if (result.hostChanged) {
    const nextName = result.newhostNameTag ?? '알수없음';
    await interaction.followUp({ content: `개최자가 **${nextName}**(<@${result.newHostId}>)로 변경되었습니다.`, ephemeral: true });
  }
  return edit(lobbyMsg, buildLobbyMessage(room));
}

/** 종료 */
async function end(interaction, room) {
  if (!ensureEndPerm(interaction, room)) return;
  const lobbyMsg = await fetchRoomMessage(interaction, room);
  await interaction.reply({ ephemeral: true, content: '내전 종료.' });
  return edit(lobbyMsg, { embeds: [], components: [], content: `\`[종료]\` ${room.title ?? ''}` });
}

module.exports = { join, tierModal, leave, expelOpen, expelApply, end };
