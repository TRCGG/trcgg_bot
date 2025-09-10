// 허용: GM|C|M → 1~2600,  DEPGSBI → 1~4,  U(언랭크) → 숫자 없음
const TIER_REGEX = /^(U|GM|[CMDEPGSBI])(\d{0,4})$/i;

// 단일 진실의 원천 (SSOT) — 티어 파싱/검증/정규화
const HEADS_14 = ['D','E','P','G','S','B','I'];
const RANGES = {
  U:  { digits: false },          // 숫자 금지
  GM: { min: 1, max: 2600 },      // 1~2600
  C:  { min: 1, max: 2600 },      // 1~2600
  M:  { min: 0, max: 2600 },      // ✅ M0 허용
  ...HEADS_14.reduce((acc, h) => (acc[h] = { min: 1, max: 4 }, acc), {})
};

// "U" || "GM123" || "E4" 같은 원시 문자열을 대소문자 정규화하여 head/numStr로 파싱
function parseHeadNum(raw) {
  if (!raw) return null;
  const m = String(raw).toUpperCase().match(TIER_REGEX);
  if (!m) return null;
  const head = m[1];
  const numStr = m[2] ?? '';
  return { head, numStr }; // U면 numStr === ''
}

// 범위 검증 (RANGES 기반)
function inRange(head, numStr) {
  const rule = RANGES[head];
  if (!rule) return false;

  // U: 숫자 금지
  if (rule.digits === false) return numStr === '';

  // 그 외: 숫자 필수
  if (!numStr) return false;
  const num = parseInt(numStr, 10);
  if (Number.isNaN(num)) return false;
  return num >= rule.min && num <= rule.max;
}

// 표준 문자열로 정규화
function normalizeTier(head, numStr) {
  return head === 'U' ? 'U' : `${head}${parseInt(numStr, 10)}`;
}

// ===== 공개 API =====

// 입력 전체가 유효한 티어인지 (예: "E4", "GM500", "M0", "U")
function isValidTierInput(input) {
  const p = parseHeadNum(input);
  if (!p) return false;
  return inRange(p.head, p.numStr);
}

// 닉네임에서 `/`로 분리된 세그먼트 중 첫 유효 티어를 엄격 추출
// 예: "닉/E4/정글" → "E4",  "닉/U/정글" → "U"
function extractTierFromNameStrict(nameTag) {
  if (!nameTag) return null;
  const segs = String(nameTag).split('/').map(s => s.trim()).filter(Boolean);
  for (const seg of segs) {
    const p = parseHeadNum(seg);
    if (!p) continue;
    if (inRange(p.head, p.numStr)) {
      return normalizeTier(p.head, p.numStr);
    }
  }
  return null;
}

// 객체 형태로 파싱 (UI/정렬 등에 사용)
// 유효하지 않으면 null, U는 num=null
function parseTier(t) {
  const p = parseHeadNum(t);
  if (!p) return null;
  if (!inRange(p.head, p.numStr)) return null;
  return { head: p.head, num: p.head === 'U' ? null : parseInt(p.numStr, 10) };
}

// === 새 규칙 설정 ===
const BUCKET_ORDER = ['C','GM','M','D','E','P','G','S','B','I','U'];

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

module.exports = { isValidTierInput, extractTierFromNameStrict, tierSortKey, sortParticipantsByTier, formatParticipantsGroupedByTier };
