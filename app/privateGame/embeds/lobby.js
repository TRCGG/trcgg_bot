// src/privateGame/embeds/lobby.js
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  columns,
  StringSelectMenuBuilder,
} = require('./common');

function buildLobbyMessage(room) {
  const cols = columns(room.participants, room.cancelQueue, room.banQueue, room.hostId);
  const hostName = room.hostNameTag ?? '미정';
  const isFull = room.participants.length >= room.maxPlayers;

  const embed = new EmbedBuilder()
    .setTitle(`개최자: ${hostName}`)
    .addFields({ name: '[참가 명단]', value: cols.left || '\u200B', inline: true });

  if (room.cancelQueue.length > 0) {
    embed.addFields({ name: '[취소 명단]', value: cols.mid || '\u200B', inline: true });
  }
  if (room.banQueue.length > 0) {
    embed.addFields({ name: '[추방 명단]', value: cols.right || '\u200B', inline: true });
  }

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`pg_join:${room.id}`).setLabel('참가').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`pg_leave:${room.id}`).setLabel('취소').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`pg_expel:${room.id}`).setLabel('추방').setStyle(ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`pg_start2:${room.id}`)
      .setLabel('시작(팀장 선택)')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!isFull),
    new ButtonBuilder().setCustomId(`pg_end:${room.id}`).setLabel('종료').setStyle(ButtonStyle.Danger),
  );

  return { embeds: [embed], components: [row1, row2] };
}

module.exports = { buildLobbyMessage };
