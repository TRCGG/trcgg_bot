// src/privateGame/embeds/common.js
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require('discord.js');

// === 새 규칙 설정 ===
const BUCKET_ORDER = ['C','GM','M','D','E','P','G','S','B','I','U'];

// t: 'E4', 'GM500' ...
function parseTier(t) {
  if (!t) return null;
  const m = String(t).toUpperCase().match(/^(U|GM|[CMDEPGSBI])(\d{0,4})$/);
  if (!m) return null;
  const head = m[1];
  const numStr  = m[2] ?? '';
  if (head === 'U') return { head, num: null }; // 숫자 없음

  const num = parseInt(numStr, 10);
  if (['C','GM','M'].includes(head)) {
    if (num < 1 || num > 2600) return null;
  } else {
    if (num < 1 || num > 4) return null;
  }
  return { head, num };
}
// 정렬키: [bucketIdx, ordinal]
// - bucketIdx: BUCKET_ORDER의 인덱스 (작을수록 먼저)
// - ordinal: C/GM/M 은 큰 수가 상위 → (2601 - num) 로 뒤집어서 '작을수록 먼저'
//           D~I 는 1,2,3,4 오름차순 그대로
function tierSortKey(tierStr) {
  const parsed = parseTier(tierStr);
  if (!parsed) return [999, 9999]; // 미지정/무효는 가장 뒤
  const { head, num } = parsed;
  const bucketIdx = BUCKET_ORDER.indexOf(head);
  if (bucketIdx === -1) return [999, 9999];

  const ordinal =
    head === "U"
      ? 9999 // U는 항상 가장 뒤
      : head === "C" || head === "GM" || head === "M"
      ? 2601 - num // 큰 수 상위 → 뒤집기
      : num; // D~I: 1→4

  return [bucketIdx, ordinal];
}

// 참가자 배열을 티어 순으로 정렬해 반환
function sortParticipantsByTier(participants) {
  return [...participants].sort((a, b) => {
    const [ba, oa] = tierSortKey(a.tierStr);
    const [bb, ob] = tierSortKey(b.tierStr);
    if (ba !== bb) return ba - bb;
    if (oa !== ob) return oa - ob;
    // 동일 키일 땐 이름으로 안정 정렬
    const an = (a.nameTag ?? a.userId ?? '').toString();
    const bn = (b.nameTag ?? b.userId ?? '').toString();
    return an.localeCompare(bn, 'ko');
  });
}

// 화면 표기를 위한 라인 문자열 생성 (티어 그룹 바뀔 때 공백 라인 삽입)
function formatParticipantsGroupedByTier(participants) {
  const arr = sortParticipantsByTier(participants);
  const out = [];
  let prevBucket = null;
  for (const p of arr) {
    const parsed = parseTier(p.tierStr);
    const bucket = parsed ? parsed.head : 'UNK';
    if (prevBucket !== null && bucket !== prevBucket) out.push(''); // 그룹 구분 빈 줄
    prevBucket = bucket;
    const tier = p.tierStr ? `${p.tierStr} ` : '';
    out.push(`${tier}${p.nameTag ?? p.userId}`);
  }
  return out.join('\n');
}

// (기존 columns 그대로 유지)
function columns(participants, cancelQ, banQ, hostId) {
  const left = [];
  for (let i = 0; i < 10; i++) {
    const p = participants[i];
    if (p) {
      const tier = p.tierStr ? `${p.tierStr} ` : '';
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

module.exports = {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  // 새로 내보내는 유틸
  parseTier,
  tierSortKey,
  sortParticipantsByTier,
  formatParticipantsGroupedByTier,
  // 기존
  columns,
};
