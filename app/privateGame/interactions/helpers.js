const edit = (message, payload) => message.edit(payload);
const { PermissionsBitField } = require("discord.js");

async function fetchRoomMessage(interaction, room) {
  const channel = await interaction.client.channels.fetch(room.channelId);
  return channel.messages.fetch(room.messageId);
}

function ensureHost(interaction, room) {
  if (interaction.user.id !== room.hostId) {
    interaction.reply({
      ephemeral: true,
      content: "개최자만 사용할 수 있어요.",
    });
    return false;
  }
  return true;
}

function isCaptain(interaction, room) {
  const uid = interaction.user.id;
  return room.captainA?.userId === uid || room.captainB?.userId === uid;
}

function isCaptainA(interaction, room) {
  return room.captainA?.userId === interaction.user.id;
}

function ensureSideChooser(interaction, room) {
  if (isCaptainA(interaction, room)) return true;
  interaction.reply({ ephemeral: true, content: '진영 선택은 A팀장만 할 수 있어요.' });
  return false;
}

function ensureHostOrCaptain(interaction, room) {
  if (interaction.user.id === room.hostId || isCaptain(interaction, room))
    return true;
  interaction.reply({
    ephemeral: true,
    content: "개최자 또는 팀장만 사용할 수 있어요.",
  });
  return false;
}

function hasServerManage(interaction) {
  // 길드 멤버 권한 검사 (Administrator 또는 ManageGuild)
  const perms = interaction.member?.permissions;
  if (!perms) return false;
  return (
    perms.has(PermissionsBitField.Flags.Administrator) ||
    perms.has(PermissionsBitField.Flags.ManageGuild)
  );
}

function canEnd(interaction, room) {
  return interaction.user.id === room.hostId || hasServerManage(interaction);
}

function ensureEndPerm(interaction, room) {
  if (canEnd(interaction, room)) return true;
  interaction.reply({
    ephemeral: true,
    content: "종료 권한이 없습니다. (개최자 또는 서버 관리 권한 필요)",
  });
  return false;
}

// 현재 픽 턴의 팀장만 허용
function ensureActivePicker(interaction, room) {
  const step = room.currentPickStep?.();
  if (!step) {
    interaction.reply({ ephemeral: true, content: '이미 픽이 완료되었습니다.' });
    return false;
  }
  const uid = interaction.user.id;
  const isRightCaptain =
    (step.team === 'A' && room.captainA?.userId === uid) ||
    (step.team === 'B' && room.captainB?.userId === uid);
  if (isRightCaptain) return true;
  interaction.reply({ ephemeral: true, content: `${step.team}팀 차례입니다. 해당 팀장만 지명할 수 있어요.` });
  return false;
}

module.exports = {
  edit,
  fetchRoomMessage,
  ensureHost,
  isCaptain,
  ensureHostOrCaptain,
  ensureEndPerm,
  ensureActivePicker,
  ensureSideChooser,
};
