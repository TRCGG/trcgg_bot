const { ensureHostOrCaptain, fetchRoomMessage, } = require('../helpers');
const { buildDraftDiceMessage } = require('../../embeds');

// 두 개의 서로 다른 주사위값(1..50)
function rollDistinct() {
  const a = Math.floor(Math.random() * 50) + 1;
  let b = Math.floor(Math.random() * 50) + 1;
  if (b === a) b = ((a % 50) + 1); // 간단 보정으로 무승부 방지
  return [a, b];
}

// 화면 열기(캡틴 지정 직후 등에서 사용 가능)
async function open(interaction, room) {
  const lobbyMsg = await fetchRoomMessage(interaction, room);
  await interaction.reply({ephemeral: true, content: '주사위 단계로 이동했습니다.'});
  // await ephemeralToast(interaction, '주사위 단계로 이동했습니다.');
  return lobbyMsg.edit(buildDraftDiceMessage(room));
}

// 주사위 클릭
async function dice(interaction, room) {
  if (!ensureHostOrCaptain(interaction, room)) return;
  const [a, b] = rollDistinct();
  room.diceA = a;
  room.diceB = b;

  const lobbyMsg = await fetchRoomMessage(interaction, room);
  await interaction.reply({ephemeral: true, content: `주사위 결과 → A:${a}, B:${b}`});
  // await ephemeralToast(interaction, `주사위 결과 → A:${a}, B:${b}`);
  return lobbyMsg.edit(buildDraftDiceMessage(room));
}

module.exports = { open, dice };
