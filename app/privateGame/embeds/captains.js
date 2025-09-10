const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('./common');
const { formatParticipantsGroupedByTier } = require('../utils/tierUtils');

function buildCaptainSelectMessage(room) {
  const embed = new EmbedBuilder()
    .setTitle('팀장 선택')
    .setDescription(
      `[참가 명단]\n\n${
        formatParticipantsGroupedByTier(room.participants) || '참가자가 없습니다.'
      }`
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`pg_choose_captains:${room.id}`).setLabel('팀장 선택').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`pg_back_lobby:${room.id}`).setLabel('처음으로').setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row] };
}

module.exports = { buildCaptainSelectMessage };
