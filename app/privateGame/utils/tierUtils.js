// 허용: GM|C|M → 1~2600,  DEPGSBI → 1~4,  U(언랭크) → 숫자 없음
const TIER_REGEX = /^(U|GM|[CMDEPGSBI])(\d{0,4})$/i;

function isValidTierInput(input) {
  if (!input) return false;
  const m = String(input).toUpperCase().match(TIER_REGEX);
  if (!m) return false;

  const head = m[1];
  const numStr = m[2] ?? '';

  // U는 숫자 없이 단독만 허용
  if (head === 'U') return numStr === '';

  // 숫자 필수
  if (!numStr) return false;
  const num = parseInt(numStr, 10);

  if (['C', 'GM', 'M'].includes(head)) {
    return num >= 1 && num <= 5000;
  }
  return num >= 1 && num <= 4;
}

function extractTierFromNameStrict(nameTag) {
  if (!nameTag) return null;
  const segs = String(nameTag).split('/').map(s => s.trim()).filter(Boolean);
  for (const seg of segs) {
    const up = seg.toUpperCase();
    if (up === 'U') return 'U';
    const m = up.match(TIER_REGEX);
    if (!m) continue;
    const head = m[1];
    const numStr = m[2] ?? '';
    if (head === 'U') return 'U';
    if (!numStr) continue;
    const num = parseInt(numStr, 10);
    if (['C', 'GM', 'M'].includes(head)) {
      if (num >= 1 && num <= 5000) return `${head}${num}`;
    } else {
      if (num >= 1 && num <= 4) return `${head}${num}`;
    }
  }
  return null;
}

module.exports = { isValidTierInput, extractTierFromNameStrict };
