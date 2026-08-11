class BotError extends Error {
  /**
   * @param {object} [meta]
   * @param {boolean} [meta.expected] 호출부가 정상 분기로 선언한 상태코드인지
   */
  constructor(message, status, meta = {}) {
    super(message);
    this.name = 'BotError';
    this.status = status;
    this.expected = Boolean(meta.expected);
    this.method = meta.method;
    this.url = meta.url;
    // 응답이 JSON이 아니었을 때만 채워진다 (프록시 HTML·빈 본문 추적용)
    this.bodySnippet = meta.bodySnippet;
    Object.setPrototypeOf(this, BotError.prototype);
  }
}

module.exports = { BotError };
