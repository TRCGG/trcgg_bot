const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('./common');
const { sortParticipantsByTier } = require('./common');

function displayLineFromUserId(room, userId) {
  const p = room.participants.find(x => x.userId === userId)
        || room.captainA?.userId === userId && room.captainA
        || room.captainB?.userId === userId && room.captainB;
  if (!p) return '';
  const tier = p.tierStr ? `${p.tierStr} ` : '';
  return `${tier}${p.nameTag ?? p.userId}`;
}

function buildDraftDiceMessage(room) {
  const diceA = Number.isInteger(room.diceA) ? room.diceA : '-';
  const diceB = Number.isInteger(room.diceB) ? room.diceB : '-';

  // 팀 라인(1~5) - 1번은 팀장 고정, 나머지는 현재 팀 배열을 기반으로 채움(없으면 공란)
  const aLines = [];
  const bLines = [];
  // 1번 = 팀장
  aLines.push(`1  ${displayLineFromUserId(room, room.captainA?.userId) || '-'}`);
  bLines.push(`1  ${displayLineFromUserId(room, room.captainB?.userId) || '-'}`);
  // 2~5번 = teamA/teamB의 현재원 (userId 배열 가정)
  for (let i = 0; i < 4; i++) {
    const aUid = room.teamA?.[i];
    const bUid = room.teamB?.[i];
    aLines.push(`${i+2}  ${aUid ? displayLineFromUserId(room, aUid) : ''}`);
    bLines.push(`${i+2}  ${bUid ? displayLineFromUserId(room, bUid) : ''}`);
  }

  // 남은 선수: 참가자에서 팀장/양팀 제외 후 티어순
  const taken = new Set([
    room.captainA?.userId,
    room.captainB?.userId,
    ...(room.teamA || []),
    ...(room.teamB || []),
  ].filter(Boolean));
  const remaining = sortParticipantsByTier(room.participants.filter(p => !taken.has(p.userId)));
  const remainingLines = remaining.map((p, idx) => {
    const tier = p.tierStr ? `${p.tierStr} ` : '';
    return `${idx + 1}  ${tier}${p.nameTag ?? p.userId}`;
  }).join('\n') || '-';

  const embed = new EmbedBuilder()
    .setTitle('팀원 선택 화면 (주사위 굴리기)')
    .addFields(
      { name: `A팀 (${diceA})`, value: aLines.join('\n'), inline: true },
      { name: `B팀 (${diceB})`, value: bLines.join('\n'), inline: true },
    )
    .addFields(
      { name: '남은 선수', value: remainingLines, inline: false }
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`pg_dice:${room.id}`).setLabel('주사위').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`pg_back_lobby:${room.id}`).setLabel('처음으로').setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row] };
}

module.exports = { buildDraftDiceMessage };
