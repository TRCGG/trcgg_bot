const { Events } = require("discord.js");
const replayService = require("../services/replayService");
const championShipService = require("../services/championShipService");
const stringUtils = require("../utils/stringUtils");

/**
 * 디코 메시지 발생 이벤트
 */
module.exports = {
  name: Events.MessageCreate,
  once: false,
  async execute(client, msg) {
    const prefix = "!";
    if (msg.author.bot) return;
    if (msg.attachments.size > 0) {
      const fileUrl = msg.attachments.first().url;
      const fileName = msg.attachments.first().name;
      const guildId = stringUtils.encodeGuildId(msg.guild.id);
      const createUser = msg.member.nickname || msg.author.username;

      // rofl 파일 아닌 경우 무시
      if (!fileName.endsWith(".rofl")) return;

      // rofl 확장자 제거
      const fileNameWithoutExt = fileName.endsWith(".rofl")
        ? fileName.slice(0, -5)
        : fileName;

      // 대회 리플 파일인지 일반 리플 파일인지 구분
      if (championShipCheck(fileName)) {
        try {
          result = await championShipService.save(
            fileUrl,
            fileNameWithoutExt,
            createUser,
            guildId,
            2
          );
          msg.reply(result);
          return;
        } catch (error) {
          msg.reply(error.message);
          return;
        }
      } 

      // 일반 리플 파일인 경우
      if (fileNameCheck(fileName)) {
        try {
          result = await replayService.save(
            fileUrl,
            fileNameWithoutExt,
            createUser,
            guildId,
            1
          );
          msg.reply(result);
        } catch (error) {
          msg.reply(error.message);
        }
      } else {
        msg.reply(
          `:red_circle:등록실패: ${fileNameWithoutExt} 잘못된 리플 파일 형식`
        );
      }
    } else {
      if (!msg.content.startsWith(prefix)) return;
      if (msg.content.slice(0, prefix.length) !== prefix) return;

      const args = msg.content.slice(prefix.length).trim().split(/ +/g);
      const command = args.shift().toLowerCase();

      try {
        let cmd = client.commands.get(command);
        if (cmd) cmd.run(client, msg, args); // 명령어 실행
      } catch (error) {
        console.error(error);
        msg.reply("명령어 실행 중 오류가 발생했습니다.");
      }
    }
  },
};

// 리플 파일 정규식 검사
const fileNameCheck = (fileName) => {
  const regex = new RegExp(/^[a-zA-Z0-9]*_\d{4}_\d{4}\.rofl$/);
  return regex.test(fileName);
};

// 대회 리플 파일 정규식 검사
const championShipCheck = (fileName) => {
  const regex = new RegExp(/^[a-zA-Z0-9]*_\d{4}_\d{4}_champs\.rofl$/);
  return regex.test(fileName);
}
