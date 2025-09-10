const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, displayLineFromUserId } = require('./common');

/**
 * @param {*} room 
 * @desc 경기 진행 화면 생성
 */
function buildMatchMessage(room) {
  const sideA = room.side?.A || null;            // 'BLUE' | 'RED' | null
  const sideB = sideA ? (sideA === 'BLUE' ? 'RED' : 'BLUE') : null;

  const aTitle = `A 1팀${sideA ? (sideA==='BLUE' ? '(블루)' : '(레드)') : ''}`;
  const bTitle = `B 2팀${sideB ? (sideB==='BLUE' ? '(블루)' : '(레드)') : ''}`;

  const aLines = [];
  const bLines = [];
  // 1번 = 팀장
  aLines.push(`1  ${displayLineFromUserId(room, room.captainA?.userId) || '-'}`);
  bLines.push(`1  ${displayLineFromUserId(room, room.captainB?.userId) || '-'}`);
  // 2~5번 = 팀원 (지명 순)
  for (let i = 0; i < 4; i++) {
    aLines.push(`${i + 2}  ${room.teamA[i] ? displayLineFromUserId(room, room.teamA[i]) : ''}`);
    bLines.push(`${i + 2}  ${room.teamB[i] ? displayLineFromUserId(room, room.teamB[i]) : ''}`);
  }

  const embed = new EmbedBuilder()
    .setTitle('경기 진행')
    .addFields(
      { name: aTitle, value: aLines.join('\n'), inline: true },
      { name: bTitle, value: bLines.join('\n'), inline: true },
    );

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`pg_side_open:${room.id}`).setLabel('진영 선택').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`pg_back_lobby:${room.id}`).setLabel('처음으로').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`pg_end:${room.id}`).setLabel('종료').setStyle(ButtonStyle.Danger),
  );

  return { embeds: [embed], components: [row1] };
}


/**
 * @param {*} room 
 * @param {*} chooserTeam
 * @desc A팀 진영 선택 드롭다운 (에페메랄)
 */
function buildSideSelectEphemeral(room, chooserTeam) {
  const label = chooserTeam === 'B' ? 'B팀 진영을 선택하세요' : 'A팀 진영을 선택하세요';
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`pg_side_apply:${room.id}`)
    .setPlaceholder(label)
    .setMinValues(1).setMaxValues(1)
    .addOptions(
      { label: '블루', value: 'BLUE' },
      { label: '레드', value: 'RED'  },
    );
  const row = new ActionRowBuilder().addComponents(menu);
  return { content: label, components: [row], ephemeral: true };
}

module.exports = { buildMatchMessage, buildSideSelectEphemeral };
