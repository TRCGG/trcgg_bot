const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('./common');
const { sortParticipantsByTier } = require('./common');

function displayLineFromUserId(room, userId) {
  if (!userId) return '';
  const src = room.participants.find(p => p.userId === userId)
          || (room.captainA?.userId === userId ? room.captainA : null)
          || (room.captainB?.userId === userId ? room.captainB : null);
  if (!src) return '';
  const tier = src.tierStr ? `${src.tierStr} ` : '';
  return `${tier}${src.nameTag ?? src.userId}`;
}

function buildDraftPickMessage(room) {
  const aLines = [];
  const bLines = [];
  aLines.push(`1  ${displayLineFromUserId(room, room.captainA?.userId) || '-'}`);
  bLines.push(`1  ${displayLineFromUserId(room, room.captainB?.userId) || '-'}`);
  for (let i = 0; i < 4; i++) {
    aLines.push(`${i + 2}  ${room.teamA[i] ? displayLineFromUserId(room, room.teamA[i]) : ''}`);
    bLines.push(`${i + 2}  ${room.teamB[i] ? displayLineFromUserId(room, room.teamB[i]) : ''}`);
  }

  const taken = new Set([
    room.captainA?.userId, room.captainB?.userId,
    ...(room.teamA || []), ...(room.teamB || []),
  ].filter(Boolean));

  const remaining = sortParticipantsByTier(room.participants.filter(p => !taken.has(p.userId)));
  const remainingLines = remaining.map((p, idx) => {
    const tier = p.tierStr ? `${p.tierStr} ` : '';
    return `${idx + 1}  ${tier}${p.nameTag ?? p.userId}`;
  }).join('\n') || '-';

  const step = room.currentPickStep();
  const hasStarted = !!(room.pickOrder && room.pickOrder.length > 0);
  const isDone = room.isTeamsFull;
  const turnText = isDone
    ? "픽 완료"
    : step
    ? `${step.team}팀 차례 — ${step.count}명 지명`
    : "선뽑 팀장이 먼저 1명을 지명하세요";

  const embed = new EmbedBuilder()
    .setTitle('팀원 선택 화면 (지명 단계)')
    .setDescription(`턴: **${turnText}**`)
    .addFields(
      { name: 'A팀', value: aLines.join('\n'), inline: true },
      { name: 'B팀', value: bLines.join('\n'), inline: true },
      { name: '남은 선수 (티어순)', value: remainingLines, inline: false },
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`pg_pick_choose:${room.id}`).setLabel('팀원 뽑기').setStyle(ButtonStyle.Primary)
      .setDisabled(isDone), // ✅ 픽이 모두 끝났을 때만 비활성화
    new ButtonBuilder().setCustomId(`pg_back_lobby:${room.id}`).setLabel('처음으로').setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row] };
}

module.exports = { buildDraftPickMessage };
