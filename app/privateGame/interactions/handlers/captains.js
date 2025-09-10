const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { ensureHost, ensureHostOrCaptain, fetchRoomMessage } = require('../helpers');
const { buildCaptainSelectMessage, buildDraftDiceMessage, buildLobbyMessage } = require('../../embeds');
const { sortParticipantsByTier } = require('../../utils/tierUtils')


/**
 * @param {*} interaction 
 * @param {*} room 
 * @desc 팀장 선택 화면 전환
 */
async function startPhase(interaction, room) {
  if (!ensureHost(interaction, room)) return;
  const lobbyMsg = await fetchRoomMessage(interaction, room);
  await interaction.deferUpdate();
  return lobbyMsg.edit(buildCaptainSelectMessage(room));
}

/**
 * @param {*} interaction 
 * @param {*} room 
 * @desc 팀장 2명 선택
 */
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

/**
 * @param {*} interaction 
 * @param {*} room 
 * @desc 팀장 지정 완료
 */
async function apply(interaction, room) {
  if (!ensureHost(interaction, room)) return;
  const [idA, idB] = interaction.values;
  const res = room.setCaptains ? room.setCaptains(idA, idB) : { ok: false };
  if (!res.ok) {
    return interaction.reply({ ephemeral: true, content: '팀장 지정에 실패했습니다. 다시 시도해주세요.' });
  }
  await interaction.deferUpdate();
  await interaction.deleteReply();
  // await interaction.update({ content: '팀장이 지정되었습니다.', components: [] });
  const lobbyMsg = await fetchRoomMessage(interaction, room);
  return lobbyMsg.edit(buildDraftDiceMessage(room));
}


/**
 * @param {*} interaction 
 * @param {*} room 
 * @desc 처음으로
 */
async function backToLobby(interaction, room) {
  if(ensureHostOrCaptain(interaction, room)){
    room.resetToLobby();
    const lobbyMsg = await fetchRoomMessage(interaction, room);
    await interaction.deferUpdate();
    return lobbyMsg.edit(buildLobbyMessage(room));
  };
}

module.exports = { startPhase, openSelect, apply, backToLobby };
