// src/privateGame/embeds/common.js
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require('discord.js');

// (기존 columns 그대로 유지)
function columns(participants, cancelQ, banQ, hostId) {
  const left = [];
  for (let i = 0; i < 10; i++) {
    const p = participants[i];
    if (p) {
      const tier = p.tierStr ? `\`${p.tierStr}\` ` : '';
      const hostMark = p.userId === hostId ? ' (host)' : '';
      left.push(`${i + 1}  ${tier}${p.nameTag ?? ''}${hostMark}`);
    } else {
      left.push(`${i + 1}  `);
    }
  }
  const mid = [];
  for (let i = 0; i < cancelQ.length; i++) mid.push(`${i + 1}  ${cancelQ[i]?.nameTag ?? ''}`);
  const right = [];
  for (let i = 0; i < banQ.length; i++) right.push(`${i + 1}  ${banQ[i]?.nameTag ?? ''}`);
  return { left: left.join('\n'), mid: mid.join('\n'), right: right.join('\n') };
}

// userId로 참가자/캡틴을 찾아 "티어 + 이름" 문자열로 반환
function displayLineFromUserId(room, userId) {
  if (!userId) return '';
  const p =
    room.participants.find(x => x.userId === userId) ||
    (room.captainA?.userId === userId ? room.captainA : null) ||
    (room.captainB?.userId === userId ? room.captainB : null);
  if (!p) return '';
  const tier = p.tierStr ? `\`${p.tierStr}\` ` : '';
  return `${tier}${p.nameTag ?? p.userId}`;
}

module.exports = {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  // 새로 내보내는 유틸
  // 기존
  columns,
  displayLineFromUserId,
};
