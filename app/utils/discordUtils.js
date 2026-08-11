const { PermissionsBitField } = require('discord.js');

/**
 * 디스코드 전송 공용 유틸 — 전송 전 권한 확인 + 폴백 + 예외 격리
 *
 * 봇은 ViewChannel만 있으면 메시지를 수신하지만 전송은 SendMessages를 따로 요구한다.
 * 즉 "읽히지만 못 쓰는" 채널이 정상적으로 존재하며, 이때 전송은 50013으로 실패한다.
 *
 * safeSend/safeReply는 호출부가 await를 빠뜨려도 미처리 rejection이 생기지 않도록
 * 어떤 경우에도 예외를 밖으로 던지지 않는다 (boolean 반환).
 */

const DiscordCode = {
  UNKNOWN_CHANNEL: 10003,
  UNKNOWN_MESSAGE: 10008,
  MISSING_ACCESS: 50001,
  CANNOT_SEND_DM: 50007,
  MISSING_PERMISSIONS: 50013,
  INVALID_FORM_BODY: 50035,
};

// 삭제된 채널의 id는 되살아나지 않으므로 영구 제외한다.
// 권한 오류(50001/50013)는 넣지 않는다 — 운영자가 권한을 되돌리면
// canSend가 다시 통과시켜 스스로 복구돼야 한다.
const unreachable = new Set();

const FLAG_NAMES = new Map(
  Object.entries(PermissionsBitField.Flags).map(([name, bit]) => [bit, name]),
);

const requiredFlags = (channel, payload) => {
  const flags = [PermissionsBitField.Flags.ViewChannel];

  // 스레드 게시는 SendMessages가 아니라 SendMessagesInThreads를 본다.
  // 부모 채널만 막고 스레드는 열어두는 설정이 흔해, 구분하지 않으면 보낼 수 있는데도 폴백한다.
  flags.push(
    typeof channel.isThread === 'function' && channel.isThread()
      ? PermissionsBitField.Flags.SendMessagesInThreads
      : PermissionsBitField.Flags.SendMessages,
  );

  const body = typeof payload === 'string' ? {} : (payload ?? {});
  if (body.files?.length) flags.push(PermissionsBitField.Flags.AttachFiles);
  if (body.embeds?.length) flags.push(PermissionsBitField.Flags.EmbedLinks);
  return flags;
};

/**
 * 실패할 요청을 아예 보내지 않기 위한 사전 확인.
 * 확인 직후 권한이 바뀌는 경합은 막지 못하므로 호출부의 catch와 함께 써야 한다.
 */
const canSend = (channel, payload) => {
  if (!channel || unreachable.has(channel.id)) return false;
  if (typeof channel.isTextBased === 'function' && !channel.isTextBased()) return false;
  // DM 채널엔 권한 오버라이트가 없어 permissionsFor가 null을 돌려준다.
  if (!channel.guild) return true;
  const me = channel.guild.members.me;
  if (!me) return false;
  const perms = channel.permissionsFor(me);
  return Boolean(perms && perms.has(requiredFlags(channel, payload)));
};

/**
 * 어떤 권한이 없어서 막혔는지 계산한다. 손으로 적지 않으므로 실제와 어긋날 수 없고,
 * 운영자가 무엇을 부여하면 되는지 그대로 알려준다.
 */
const missingPermissions = (channel, payload) => {
  if (!channel) return ['NO_CHANNEL'];
  if (unreachable.has(channel.id)) return ['CHANNEL_DELETED'];
  if (!channel.guild) return [];
  const me = channel.guild.members.me;
  if (!me) return ['BOT_NOT_IN_GUILD'];
  const perms = channel.permissionsFor(me);
  if (!perms) return ['PERMISSIONS_UNAVAILABLE'];
  return requiredFlags(channel, payload)
    .filter((flag) => !perms.has(flag))
    .map((flag) => FLAG_NAMES.get(flag) ?? String(flag));
};

const isPermissionDenied = (error) =>
  error?.code === DiscordCode.MISSING_PERMISSIONS ||
  error?.code === DiscordCode.MISSING_ACCESS;

// 50035는 폼 바디 오류 전반이라 message_reference를 지목한 경우에만 답장 실패로 본다.
// 그 외 50035(잘못된 페이로드)는 폴백으로 숨기지 않고 그대로 드러낸다.
// 응답에서 키는 소문자(message_reference), 코드는 대문자(MESSAGE_REFERENCE_UNKNOWN_MESSAGE)로
// 오므로 대소문자를 맞춰 비교한다.
const isStaleReference = (error) => {
  if (error?.code === DiscordCode.UNKNOWN_MESSAGE) return true;
  if (error?.code !== DiscordCode.INVALID_FORM_BODY) return false;
  try {
    return JSON.stringify(error.rawError ?? '').toLowerCase().includes('message_reference');
  } catch {
    return false; // 직렬화 불가한 rawError
  }
};

const markIfGone = (channelId, error) => {
  if (channelId && error?.code === DiscordCode.UNKNOWN_CHANNEL) unreachable.add(channelId);
};

/**
 * @returns {Promise<boolean>} 전송 성공 여부. 예외를 던지지 않는다.
 */
const safeSend = async (channel, payload, ctx = '') => {
  try {
    if (!canSend(channel, payload)) {
      // 스케줄·콜백처럼 고정 채널로 보내는 경로는 조용히 실패하면 영원히 모른다.
      console.warn('[safeSend] 전송 불가', {
        channel: channel?.id,
        missing: missingPermissions(channel, payload),
        ctx,
      });
      return false;
    }
    await channel.send(payload);
    return true;
  } catch (error) {
    markIfGone(channel?.id, error);
    console.warn('[safeSend] 전송 실패', { channel: channel?.id, code: error?.code, ctx });
    return false;
  }
};

const sendToAuthor = async (msg, payload) => {
  try {
    await msg.author.send(
      typeof payload === 'string'
        ? `${payload}\n(원본 채널에 봇 전송 권한이 없어 DM으로 보냅니다.)`
        : payload,
    );
    return true;
  } catch {
    return false; // DM 차단(50007) — 더 할 수 있는 게 없다
  }
};

/**
 * 답장 → (원본 삭제 시) 같은 채널 일반 전송 → DM 순으로 떨어진다.
 * @returns {Promise<boolean>} 어느 경로로든 전달됐는지. 예외를 던지지 않는다.
 */
const safeReply = async (msg, payload, ctx = '') => {
  try {
    if (canSend(msg.channel, payload)) {
      try {
        await msg.reply(payload);
        return true;
      } catch (error) {
        markIfGone(msg.channel?.id, error);

        if (isStaleReference(error)) {
          // 원본이 지워졌을 뿐이니 같은 채널에 일반 전송으로 떨군다.
          if (await safeSend(msg.channel, payload, ctx)) return true;
        } else if (!isPermissionDenied(error) && error?.code !== DiscordCode.UNKNOWN_CHANNEL) {
          // 권한·채널 문제가 아니면 폴백해도 같은 이유로 실패한다. 숨기지 않고 드러낸다.
          console.warn('[safeReply] 답장 실패', { channel: msg.channel?.id, code: error?.code, ctx });
          return false;
        }
      }
    }

    // 폴백은 사용자 피해만 막고 원인(채널 권한)은 그대로 남는다.
    // 여기서 기록하지 않으면 어느 길드를 고쳐야 하는지 알 방법이 없어진다.
    const missing = missingPermissions(msg.channel, payload);
    const delivered = await sendToAuthor(msg, payload);
    console.warn('[safeReply] 채널 전송 불가 → DM 폴백', {
      guild: msg.guild?.id,
      channel: msg.channel?.id,
      missing,
      delivered,
      ctx,
    });
    return delivered;
  } catch (error) {
    // 호출부가 await를 빠뜨려도 미처리 rejection이 되지 않아야 한다.
    console.warn('[safeReply] 예기치 못한 실패', { message: error?.message, ctx });
    return false;
  }
};

module.exports = { canSend, safeSend, safeReply, missingPermissions, unreachable, DiscordCode };
