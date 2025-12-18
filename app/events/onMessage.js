const { Events } = require("discord.js");
const replayService = require("../services/replayService");

/**
 * 디코 메시지 발생 이벤트
 */
module.exports = {
  name: Events.MessageCreate,
  once: false,
  async execute(client, msg) {
    const prefix = "!";
    if (!msg.inGuild()) return; // DM 차단 및 길드 내 메시지만 처리
    if (msg.author.bot) return;
    // 첨부파일이 있는 경우
    if (msg.attachments.size > 0) {
      if (msg.guild.id === "922118764437340230") return;

      for (const [id, attachment] of msg.attachments) {
        const fileName = attachment.name;
        const fileUrl = attachment.url;

        if (!fileName.endsWith(".rofl")) continue; 

        const guildId = msg.guild.id;
        const guildName = msg.guild.name;
        const createUser = msg.member.nickname || msg.author.username;
        const fileNameWithoutExt = fileName.slice(0, -5);
        const gameType = '1'; // 1: 내전 2: 대회

        try {
          const result = await replayService.save(
            fileUrl,
            fileNameWithoutExt,
            createUser,
            guildId,
            gameType,
            guildName
          );

          msg.reply(`:green_circle: 등록완료: ${fileNameWithoutExt}`);
        } catch (error) {
          console.error('replays error:', error);
          if (error.status === 400) {
            msg.reply(`:warning: 이미 등록된 리플 파일: ${fileNameWithoutExt}`);
          } 
          // 그 외 에러
          else {
            msg.reply(`:red_circle: 등록실패: ${fileNameWithoutExt}: ${error.message}`);
          }

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

// TO-DO 대회일경우 끝에 _champs.rofl 붙이기.
// const championShipCheck = (fileName) => {
//   const regex = new RegExp(/^[a-zA-Z0-9]*_\d{4}_\d{4}_champs\.rofl$/);
//   return regex.test(fileName);
// };
