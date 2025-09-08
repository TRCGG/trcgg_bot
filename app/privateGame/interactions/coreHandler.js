const store = require('../stores/privateGameStore');
const lobby = require('./handlers/lobby');
const captains = require('./handlers/captains');
const draft = require('./handlers/draft');
const match = require('./handlers/match');

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

  // 3.1
  if (action === 'dice' && interaction.isButton()) return draft.dice(interaction, room);

  // 3.2
  if (action === 'pick_open' && interaction.isButton()) return draft.pickOpen(interaction, room);
  if (action === 'pick_choose' && interaction.isButton()) return draft.pickChoose(interaction, room);
  if (action === 'pick_apply' && interaction.isStringSelectMenu()) return draft.pickApply(interaction, room);

  // 4단계 매치
  if (action === 'side_open' && interaction.isButton()) return match.openSideSelect(interaction, room);
  if (action === 'side_apply' && interaction.isStringSelectMenu()) return match.applySide(interaction, room);
  
};
