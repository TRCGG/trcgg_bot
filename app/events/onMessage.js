const { Events } = require("discord.js");
const replayService = require("../services/replayService");
const {
  BotError,
  BotErrorType,
  DISCORD_UPSTREAM_TYPES,
  UNSUPPORTED_REPLAY_VERSION_TYPE,
  NO_OPEN_COMPETITION_TYPE,
} = require("../utils/errors");
const { safeReply } = require("../utils/discordUtils");

// 리플 첨부 메시지의 첫 토큰이 정확히 이 명령일 때만 유형을 바꾼다 (1=일반내전/2=스크림/3=본경기).
// startsWith로 하면 `!대회개설 이름` + 첨부가 본경기로 오태깅된다.
const REPLAY_TAG_COMMANDS = { '!스크림': '2', '!대회': '3' };
const GAME_TYPE_LABEL = { '2': '스크림', '3': '본경기' };

const resolveReplayGameType = (content) => {
  const firstToken = (content || '').trim().split(/\s+/)[0];
  return REPLAY_TAG_COMMANDS[firstToken] || '1';
};

const describeSavedReplay = (replayCode, gameType, competitionName) => {
  if (gameType === '1') return `:green_circle: 등록완료: ${replayCode}`;
  const label = GAME_TYPE_LABEL[gameType];
  const scope = competitionName ? `${label} · ${competitionName}` : label;
  return `:green_circle: 등록완료(${scope}): ${replayCode}`;
};

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
  if (error.type === UNSUPPORTED_REPLAY_VERSION_TYPE) {
    return `:warning: 구형 리플 파일(패치 14.11 이전)이라 등록할 수 없습니다: ${fileName}`;
  }
  if (error.type === NO_OPEN_COMPETITION_TYPE) {
    return `:warning: 진행 중인 대회가 없습니다. \`!대회개설 [이름]\` 후 다시 올려주세요: ${fileName}`;
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

      // msg.member는 저장된 값이 아니라 멤버 캐시 조회 getter다. 첨부가 여러 개면
      // 앞 파일의 업로드(수십 초)를 기다리는 사이 캐시 스윕이 걸려 null이 될 수 있으므로
      // 루프에 들어가기 전에 한 번만 읽는다.
      const createUser = msg.member?.nickname || msg.author.username;
      // 대회는 백엔드가 OPEN 대회로 해석한다. 여기서 먼저 조회하면 첨부 여러 개를 저장하는
      // 사이에 !대회종료가 끼어들어 뒤 파일이 닫힌 대회에 붙을 수 있다.
      const gameType = resolveReplayGameType(msg.content);

      for (const [id, attachment] of msg.attachments) {
        const fileName = attachment.name;
        const fileUrl = attachment.url;

        if (!fileName.endsWith(".rofl")) continue;

        const guildId = msg.guild.id;
        const guildName = msg.guild.name;
        const fileNameWithoutExt = fileName.slice(0, -5);

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

          await safeReply(msg, describeSavedReplay(replayCode, gameType, result.competitionName));
        } catch (error) {
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
