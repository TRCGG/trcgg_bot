class BotError extends Error {
  /**
   * @param {object} [meta]
   * @param {boolean} [meta.expected] 호출부가 정상 분기로 선언한 상태코드인지
   * @param {string} [meta.type] 백엔드 ProblemDetails.type — 실패 원인 구분자
   */
  constructor(message, status, meta = {}) {
    super(message);
    this.name = 'BotError';
    this.status = status;
    this.expected = Boolean(meta.expected);
    // errorHandler에서 detail만 showMessage 게이트를 타고 type은 항상 나온다.
    // 내부 메시지를 숨긴 5xx에서도 원인을 알 수 있는 유일한 필드다 (TRC-261 계약).
    this.type = meta.type;
    this.method = meta.method;
    this.url = meta.url;
    this.guildId = meta.guildId;
    // 응답이 JSON이 아니었을 때만 채워진다 (프록시 HTML·빈 본문 추적용)
    this.bodySnippet = meta.bodySnippet;
    Object.setPrototypeOf(this, BotError.prototype);
  }
}

// 봇이 스스로 판정한 실패 원인. 백엔드 ProblemDetails.type과 같은 자리에 싣는다.
const BotErrorType = {
  TIMEOUT: 'request-timeout',
  UNREACHABLE: 'connection-failed',
};

// 백엔드가 Discord를 기다리다 못 끝낸 경우 (TRC-261 계약).
// 프록시가 내는 502·504와 상태코드가 같으므로 원인 판단은 반드시 이 type으로 한다.
const DISCORD_UPSTREAM_TYPES = new Set(['discord-download-timeout', 'discord-download-failed']);

// 구형 리플(~패치 14.10) 미지원 거절 (백엔드 ProblemDetails.type)
const UNSUPPORTED_REPLAY_VERSION_TYPE = 'unsupported-replay-version';

// 스크림/본경기 리플인데 붙일 OPEN 대회가 없음 (TRC-283). 중복 리플과 같은 400이라 type으로만 구분된다.
const NO_OPEN_COMPETITION_TYPE = 'no-open-competition';

// 백엔드 notFoundHandler — 라우트 자체가 없을 때. 본문에 요청 URL이 들어 있어 사용자에게 보이면 안 된다.
const ROUTE_NOT_FOUND_TYPE = 'https://example.com/problems/not-found';

module.exports = {
  BotError,
  BotErrorType,
  DISCORD_UPSTREAM_TYPES,
  UNSUPPORTED_REPLAY_VERSION_TYPE,
  NO_OPEN_COMPETITION_TYPE,
  ROUTE_NOT_FOUND_TYPE,
};
