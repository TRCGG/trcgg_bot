const { BotError } = require('./errors');

module.exports = {
  // 성공 처리
  success: (msg, text) => msg.reply(`✅ ${text}`),

  // 에러 처리
  // BotError 5xx: 시스템 에러 → 메시지 숨김
  // BotError 4xx: 비즈니스 에러 → 백엔드 메시지 노출
  // 그 외 (로컬 유효성 등): 메시지 노출
  error: (msg, error) => {
    if (error instanceof BotError && error.status >= 500) {
      console.error(error);
      return msg.reply(`⚠️ 오류가 발생했습니다.`);
    }
    msg.reply(`⚠️ ${error.message || "알 수 없는 오류"}`);
  },

  // 권한 없음
  noAuth: (msg) => msg.reply("⛔ 권한이 없습니다."),
};