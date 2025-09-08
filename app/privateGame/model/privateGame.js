// src/privateGame/model/privateGame.js
const { randomUUID } = require('crypto');

function pushFifo(queue, item, limit = 5) {
  queue.push(item);
  while (queue.length > limit) queue.shift();
}

/**
 * 1단계용 최소 모델 (stage 없음, hostId만 보관)
 * - 이후 단계(팀장/주사위/픽/진영)는 데이터 존재 여부로 분기 가능하도록 필드만 자리 확보 (선언만, 사용은 나중)
 */
class PrivateGame {
  constructor({ guildId, channelId, hostId, hostNameTag, maxPlayers = 10 }) {
    this.id = randomUUID();

    // 식별/메시지
    this.guildId = guildId;
    this.channelId = channelId;
    this.messageId = null;

    // 기본 정보
    this.maxPlayers = maxPlayers;

    this.hostId = hostId;
    this.hostNameTag = hostNameTag;

    this.participants = [];
    this.cancelQueue = []; // 최근 5 (FIFO)
    this.banQueue = []; // 최근 5 (FIFO)

    this.captainA = null;
    this.captainB = null;
    this.diceA = null;
    this.diceB = null;
    this.teamA = [];
    this.teamB = [];
    this.remaining = [];
    this.pickOrder = []; // [{team:'A'|'B', count:1|2}]
    this.pickTurnIdx = 0; // 현재 턴 인덱스
    this.side = { A: null, B: null };
  }

  // === 계산 프로퍼티(확장 대비) ===
  get hasCaptains() {
    return !!(this.captainA && this.captainB);
  }
  get hasDice() {
    return Number.isInteger(this.diceA) && Number.isInteger(this.diceB);
  }
  get isTeamsFull() {
    const a = (this.captainA ? 1 : 0) + this.teamA.length;
    const b = (this.captainB ? 1 : 0) + this.teamB.length;
    return a === 5 && b === 5;
  }
  get hasSide() {
    return this.side.A === "BLUE" || this.side.A === "RED";
  }

  /**
   * 참가자 제거 + 큐 기록 + 호스트 위임/종료 판단
   * @param {string} userId
   * @param {{ reason?: 'cancel'|'ban' }} opt
   * @returns {{ removed?: any, ended: boolean, hostChanged: boolean, newHostId?: string }}
   */
  removeParticipant(userId, opt = {}) {
    const { reason = "cancel" } = opt;
    const idx = this.participants.findIndex((p) => p.userId === userId);
    if (idx === -1) return { ended: false, hostChanged: false }; // 이미 없음

    const removed = this.participants.splice(idx, 1)[0];
    const entry = { ...removed, at: new Date() };

    if (reason === "ban") pushFifo(this.banQueue, entry, 5);
    else pushFifo(this.cancelQueue, entry, 5);

    let ended = false;
    let hostChanged = false;
    let newHostId;
    let newHostNameTag;

    if (removed.userId === this.hostId) {
      if (this.participants.length > 0) {
        this.hostId = this.participants[0].userId;
        this.hostNameTag = this.participants[0].nameTag || null;
        hostChanged = true;
        newHostId = this.hostId;
        newHostNameTag = this.hostNameTag;
      } else {
        // 더 이상 남은 사람이 없으면 종료 신호
        ended = true;
      }
    }
    return { removed, ended, hostChanged, newHostId, newHostNameTag };
  }

  setCaptains(userIdA, userIdB) {
    if (!userIdA || !userIdB || userIdA === userIdB)
      return { ok: false, reason: "invalid" };
    const copy = (uid) => {
      const p = this.participants.find((x) => x.userId === uid);
      return p
        ? { userId: p.userId, nameTag: p.nameTag, tierStr: p.tierStr }
        : null;
    };
    const a = copy(userIdA);
    const b = copy(userIdB);
    if (!a || !b) return { ok: false, reason: "not_found" };
    this.captainA = a;
    this.captainB = b;
    return { ok: true };
  }

  // ✅ 이제 선픽은 "누가 먼저 1명 지명했는지"로 결정
  initPickOrderBy(teamFirst /* 'A' | 'B' */) {
    const other = teamFirst === "A" ? "B" : "A";
    this.pickOrder = [
      { team: teamFirst, count: 1 },
      { team: other, count: 2 },
      { team: teamFirst, count: 2 },
      { team: other, count: 2 },
      { team: teamFirst, count: 1 },
    ];
    this.pickTurnIdx = 0;
  }

  currentPickStep() {
    return this.pickOrder?.[this.pickTurnIdx] ?? null;
  }

  addToTeam(team, userIds) {
    const list = team === "A" ? this.teamA : this.teamB;
    for (const uid of userIds) list.push(uid);
  }

  /**
   * 2~5단계 진행 상태를 모두 초기화하고 로비 상태로 되돌린다.
   * - 참가자/취소/추방/호스트 관련 정보는 유지
   */
  resetToLobby() {
    this.captainA = null;
    this.captainB = null;
    this.diceA = null;
    this.diceB = null;
    this.teamA = [];
    this.teamB = [];
    this.pickOrder = [];
    this.pickTurnIdx = 0;
    this.side = { A: null, B: null };
  }
}

module.exports = { PrivateGame };
