const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "..", "data", "logChannels.json");

/**
 * 로그 채널 설정을 파일에 저장하고 불러오는 모듈
 */

// 초기 데이터 로딩
let logChannels = {};
if (fs.existsSync(filePath)) {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    logChannels = JSON.parse(raw);
    // console.log(logChannels);
  } catch (e) {
    console.error("로그 채널 설정 파일 로딩 실패:", e.message);
  }
}

// 저장 함수
function saveToFile() {
  fs.writeFileSync(filePath, JSON.stringify(logChannels, null, 2), "utf-8");
}

module.exports = {
  saveLogChannel(guildId, channelId) {
    logChannels[guildId] = channelId;
    saveToFile();
  },

  getLogChannel(guildId) {
    return logChannels[guildId] || null;
  },

  removeLogChannel(guildId) {
    delete logChannels[guildId];
    saveToFile();
  },

  getAll() {
    return logChannels;
  }
};
