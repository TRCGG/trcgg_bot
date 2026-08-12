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

module.exports = { BotError };
