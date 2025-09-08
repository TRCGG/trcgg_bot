const store = require('../stores/privateGameStore');
const lobby = require('./handlers/lobby');
const captains = require('./handlers/captains');

module.exports = async (interaction) => {
  if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit()) return;

  const [prefix, roomId] = String(interaction.customId).split(':');
  if (!prefix?.startsWith('pg_')) return;

  const action = prefix.slice(3);
  const room = store.get(roomId);
  if (!room) return interaction.reply({ ephemeral: true, content: '진행 중인 내전을 찾을 수 없어요.' });

  // ===== 로비 영역 =====
  if (action === 'join' && interaction.isButton()) return lobby.join(interaction, room);
  if (action === 'tier_modal' && interaction.isModalSubmit()) return lobby.tierModal(interaction, room);
  if (action === 'leave' && interaction.isButton()) return lobby.leave(interaction, room);
  if (action === 'expel' && interaction.isButton()) return lobby.expelOpen(interaction, room);
  if (action === 'expel_select' && interaction.isStringSelectMenu()) return lobby.expelApply(interaction, room);
  if (action === 'end' && interaction.isButton()) return lobby.end(interaction, room);

  // ===== 팀장 선택(2단계) 영역 =====
  if (action === 'start2' && interaction.isButton()) return captains.startPhase(interaction, room);
  if (action === 'choose_captains' && interaction.isButton()) return captains.openSelect(interaction, room);
  if (action === 'captains_apply' && interaction.isStringSelectMenu()) return captains.apply(interaction, room);
  if (action === 'back_lobby') return captains.backToLobby(interaction, room);
};
