// src/privateGame/embeds/dice.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('./common');

function buildDicePlaceholderMessage(room) {
  const a = room.captainA ? `${room.captainA.tierStr ?? ''} ${room.captainA.nameTag ?? room.captainA.userId}`.trim() : '-';
  const b = room.captainB ? `${room.captainB.tierStr ?? ''} ${room.captainB.nameTag ?? room.captainB.userId}`.trim() : '-';

  const embed = new EmbedBuilder()
    .setTitle('3.1 단계: 팀원 선택(주사위) – 준비')
    .setDescription(`A팀: ${a}\nB팀: ${b}\n\n(다음 단계 UI는 곧 이어서 구현)`);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`pg_back_lobby:${room.id}`).setLabel('처음으로').setStyle(ButtonStyle.Secondary),
  );
  return { embeds: [embed], components: [row] };
}

module.exports = { buildDicePlaceholderMessage };
