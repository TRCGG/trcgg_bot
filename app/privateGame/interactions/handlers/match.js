const { ensureSideChooser, ensureEndPerm, fetchRoomMessage } = require('../helpers');
const { buildMatchMessage, buildSideSelectEphemeral } = require('../../embeds');

async function open(interaction, room) {
  // 매치 화면 강제 오픈이 필요할 때 사용(보통은 픽 완료 후 자동 전환)
  const msg = await fetchRoomMessage(interaction, room);
  await interaction.reply({ ephemeral: true, content: '경기 화면으로 이동했습니다.' });
  return msg.edit(buildMatchMessage(room));
}

async function openSideSelect(interaction, room) {
  if (!ensureSideChooser(interaction, room)) return;
  return interaction.reply(buildSideSelectEphemeral(room));
}

async function applySide(interaction, room) {
  if (!ensureSideChooser(interaction, room)) return;
  const val = (interaction.values?.[0] || '').toUpperCase();
  if (val !== 'BLUE' && val !== 'RED') {
    return interaction.reply({ ephemeral: true, content: '잘못된 진영입니다.' });
  }
  room.side = { A: val, B: val === 'BLUE' ? 'RED' : 'BLUE' };
  await interaction.update({ content: '진영이 설정되었습니다.', components: [] });
  const msg = await fetchRoomMessage(interaction, room);
  return msg.edit(buildMatchMessage(room));
}

module.exports = { open, openSideSelect, applySide };
