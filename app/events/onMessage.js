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
    // 첨부파일이 있는 경우
    if (msg.attachments.size > 0) {
      if (msg.guild.id === "922118764437340230") return;

      // 모든 첨부파일을 순회하며 처리
      for (const [id, attachment] of msg.attachments) {
        const fileName = attachment.name;
        const fileUrl = attachment.url;

        if (!fileName.endsWith(".rofl")) continue; // .rofl 아니면 다음 파일로

        const guildId = stringUtils.encodeGuildId(msg.guild.id);
        const createUser = msg.member.nickname || msg.author.username;
        const fileNameWithoutExt = fileName.slice(0, -5);

        try {
          let result;
          if (championShipCheck(fileName)) {
            // 대회용 리플 처리
            result = await championShipService.save(
              fileUrl,
              fileNameWithoutExt,
              createUser,
              guildId,
              2
            );
          } else if (fileNameCheck(fileName)) {
            // 일반 리플 처리
            result = await replayService.save(
              fileUrl,
              fileNameWithoutExt,
              createUser,
              guildId,
              1
            );
          } else {
            // 형식 불일치
            msg.reply(
              `:red_circle:등록실패: ${fileNameWithoutExt} 잘못된 리플 파일 형식`
            );
            continue;
          }
          msg.reply(result);
        } catch (error) {
          msg.reply(`오류 발생(${fileNameWithoutExt}): ${error.message}`);
        }
      }
      return;
    }

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
};
