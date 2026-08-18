const { Events } = require("discord.js");
const replayService = require("../services/replayService");
const { BotError, BotErrorType, DISCORD_UPSTREAM_TYPES } = require("../utils/errors");
const { safeReply } = require("../utils/discordUtils");

// 백엔드 응답 계약은 TRC-261.
const describeReplayFailure = (error, fileName) => {
  // status가 있어도 BotError가 아니면 우리 계약을 따르는 값이 아니다.
  if (!(error instanceof BotError)) return `:red_circle: 등록실패: ${fileName}`;

  // 원인은 type으로만 판단한다. 프록시(nginx)도 502·504를 내므로 status만 보면
  // 배포 중 pm2 reload가 만든 502를 Discord 탓으로 돌린다.
  if (DISCORD_UPSTREAM_TYPES.has(error.type)) {
    return `:hourglass: Discord에서 파일을 받아오지 못했습니다. 잠시 후 다시 올려주세요: ${fileName}`;
  }
  if (error.type === BotErrorType.TIMEOUT) {
    return `:hourglass: 처리 시간이 초과됐습니다. 잠시 후 다시 올려주세요: ${fileName}`;
  }
  if (error.type === BotErrorType.UNREACHABLE) {
    return `:red_circle: 서버에 연결할 수 없습니다. 관리자에게 알려주세요: ${fileName}`;
  }
  if (error.type === "unsupported-replay-version") {
    return `:warning: 구형 리플 파일(패치 14.11 이전)이라 등록할 수 없습니다: ${fileName}`;
  }

  switch (error.status) {
    case 400:
      return `:warning: 이미 등록된 리플 파일: ${fileName}`;
    case 413:
      return `:warning: 파일이 너무 큽니다: ${fileName}`;
    default:
      return `:red_circle: 등록실패: ${fileName}`;
  }
};

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
        const gameType = '1'; // 1=일반내전/2=스크림/3=대회 — 리플 첨부는 항상 일반내전

        try {
          const result = await replayService.save(
            fileUrl,
            fileNameWithoutExt,
            createUser,
            guildId,
            gameType,
            guildName
          );

          let replayCode = fileNameWithoutExt;
          if(result.replayCode){
            replayCode = result.replayCode;
          }

          await safeReply(msg, `:green_circle: 등록완료: ${replayCode}`);
        } catch (error) {
          // 400은 사용자 안내로 끝나는 정상 분기(중복·구형 리플)라 에러 로그를 남기지 않는다
          const isExpected400 = error instanceof BotError && error.status === 400;
          if (!isExpected400) {
            // 어느 파일인지는 여기만 안다. 원인은 networkUtils가 이미 남겼다.
            console.error('replays error:', {
              guild: guildId,
              file: fileNameWithoutExt,
              status: error?.status,
            });
            // BotError가 아니면 여기가 유일한 기록이라 스택이 필요하다.
            if (!(error instanceof BotError)) console.error(error);
          }
          await safeReply(msg, describeReplayFailure(error, fileNameWithoutExt));
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
      // await 없이는 명령어 내부의 비동기 예외가 아래 catch를 그냥 통과한다.
      if (cmd) await cmd.run(client, msg, args);
    } catch (error) {
      console.error(error);
      await safeReply(msg, "명령어 실행 중 오류가 발생했습니다.");
    }
  },
};

// TO-DO 대회일경우 끝에 _champs.rofl 붙이기.
// const championShipCheck = (fileName) => {
//   const regex = new RegExp(/^[a-zA-Z0-9]*_\d{4}_\d{4}_champs\.rofl$/);
//   return regex.test(fileName);
// };
