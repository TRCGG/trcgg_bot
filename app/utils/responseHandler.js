module.exports = {
  // 성공 처리
  success: (msg, text) => msg.reply(`✅ ${text}`),
  
  // 에러 처리
  error: (msg, error) => {
      console.error(error);
      const text = error.message || "알 수 없는 오류";
      msg.reply(`⚠️ ${text}`);
  },

  // 권한 없음
  noAuth: (msg) => msg.reply("⛔ 권한이 없습니다.")
};