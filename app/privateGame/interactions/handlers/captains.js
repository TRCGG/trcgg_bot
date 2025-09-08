const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { ensureHost, ensureHostOrCaptain, fetchRoomMessage } = require('../helpers');
const { buildCaptainSelectMessage, buildDraftDiceMessage, buildLobbyMessage } = require('../../embeds');
const { sortParticipantsByTier } = require('../../embeds/common');

async function startPhase(interaction, room) {
  if (!ensureHost(interaction, room)) return;
  const lobbyMsg = await fetchRoomMessage(interaction, room);
  await interaction.reply({ ephemeral: true, content: '팀장 선택 화면으로 전환되었습니다.' });
  return lobbyMsg.edit(buildCaptainSelectMessage(room));
}

async function openSelect(interaction, room) {
  if (!ensureHost(interaction, room)) return;
  if (room.participants.length < 2) {
    return interaction.reply({ ephemeral: true, content: '팀장을 선택하려면 최소 2명이 필요합니다.' });
  }

  const sorted = sortParticipantsByTier(room.participants);
  const options = sorted.map(p => ({
    label: `${p.tierStr ?? ''} ${p.nameTag ?? p.userId}`.trim(),
    value: p.userId,
  }));
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`pg_captains_apply:${room.id}`)
    .setPlaceholder('팀장 2명을 선택하세요')
    .setMinValues(2).setMaxValues(2)
    .addOptions(options);
  const row = new ActionRowBuilder().addComponents(menu);
  return interaction.reply({ ephemeral: true, content: '팀장으로 지정할 2명을 선택하세요.', components: [row] });
}

async function apply(interaction, room) {
  if (!ensureHost(interaction, room)) return;
  const [idA, idB] = interaction.values;
  const res = room.setCaptains ? room.setCaptains(idA, idB) : { ok: false };
  if (!res.ok) {
    return interaction.reply({ ephemeral: true, content: '팀장 지정에 실패했습니다. 다시 시도해주세요.' });
  }
  await interaction.update({ content: '팀장이 지정되었습니다.', components: [] });
  const lobbyMsg = await fetchRoomMessage(interaction, room);
  return lobbyMsg.edit(buildDraftDiceMessage(room));
}

async function backToLobby(interaction, room) {
  ensureHostOrCaptain(interaction, room);
  room.resetToLobby();
  const lobbyMsg = await fetchRoomMessage(interaction, room);
  await interaction.reply({ ephemeral: true, content: '로비로 돌아갑니다.' });
  return lobbyMsg.edit(buildLobbyMessage(room));
}

module.exports = { startPhase, openSelect, apply, backToLobby };
