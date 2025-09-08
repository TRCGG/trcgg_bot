const {
  ensureHostOrCaptain, ensureActivePicker,
  isPickStarted, isPickFinished,
  fetchRoomMessage,
} = require('../helpers');
const { sortParticipantsByTier } = require('../../embeds/common'); // common에서 export됨
const { buildDraftDiceMessage, buildDraftPickMessage, buildMatchMessage } = require('../../embeds');
const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

function rollDistinct() {
  const a = Math.floor(Math.random() * 50) + 1;
  let b = Math.floor(Math.random() * 50) + 1;
  if (b === a) b = ((a % 50) + 1); // 간단 보정으로 무승부 방지
  return [a, b];
}

// ===== 3.1 주사위 =====
async function open(interaction, room) {
  const lobbyMsg = await fetchRoomMessage(interaction, room);
  await interaction.reply({ephemeral: true, content: '주사위 단계로 이동했습니다.'});
  // await ephemeralToast(interaction, '주사위 단계로 이동했습니다.');
  return lobbyMsg.edit(buildDraftDiceMessage(room));
}

// 주사위 클릭
async function dice(interaction, room) {
  if (!ensureHostOrCaptain(interaction, room)) return;
  const [a, b] = rollDistinct();
  room.diceA = a;
  room.diceB = b;

  const lobbyMsg = await fetchRoomMessage(interaction, room);
  await interaction.reply({ephemeral: true, content: `주사위 결과 → A:${a}, B:${b}`});
  // await ephemeralToast(interaction, `주사위 결과 → A:${a}, B:${b}`);
  return lobbyMsg.edit(buildDraftDiceMessage(room));
}

// ===== 3.2 픽 단계 =====
function remainingSorted(room) {
  const taken = new Set([
    room.captainA?.userId, room.captainB?.userId,
    ...(room.teamA || []), ...(room.teamB || []),
  ].filter(Boolean));
  return sortParticipantsByTier(room.participants.filter(p => !taken.has(p.userId)));
}

async function pickOpen(interaction, room) {
  if (!ensureHostOrCaptain(interaction, room)) return;

  if (!Number.isInteger(room.diceA) || !Number.isInteger(room.diceB)) {
    return await interaction.reply({ephemeral: true, content: `먼저 주사위를 굴려주세요`});
    // return ephemeralToast(interaction, '먼저 주사위를 굴려주세요.');
  }

  // 마지막 1명 자동배정 처리(혹시 상태가 애매하게 남아있을 때)
  await maybeAutoAssignIfOneLeft(interaction, room);

  const lobbyMsg = await fetchRoomMessage(interaction, room);
  await interaction.reply({ephemeral: true, content: `선택 단계로 이동했습니다`});
  // await ephemeralToast(interaction, '지명 단계로 이동했습니다.');
  return lobbyMsg.edit(buildDraftPickMessage(room));
}

function currentRequiredCount(room) {
  const step = room.currentPickStep();
  return step ? step.count : 0;
}

// 남은 선수가 1명이고 현재 턴의 요구 수가 1이면 자동 배정
async function maybeAutoAssignIfOneLeft(interaction, room) {
  const step = room.currentPickStep();
  if (!step) return false;

  const rem = remainingSorted(room);
  if (rem.length === 1 && step.count === 1) {
    const last = rem[0];
    room.addToTeam(step.team, [last.userId]);
    room.pickTurnIdx += 1;
    // 다음 턴도 연쇄적으로 자동배정이 필요한지(극히 드묾) 체크 가능
    return true;
  }
  return false;
}

async function pickChoose(interaction, room) {
  const rem = remainingSorted(room);
  // 선픽 전: 선픽 확정하지 않고, 단지 "1명 선택" 드롭다운만 띄움
  if (!isPickStarted(room)) {
    // 두 팀장 중 아무나 열 수 있도록 가드(ensureActivePicker가 선픽 전은 캡틴 허용)
    if (!ensureActivePicker(interaction, room)) return;
    const options = rem.map((p) => ({
      label: `${p.tierStr ?? ""} ${p.nameTag ?? p.userId}`.trim(),
      value: p.userId,
    }));
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`pg_pick_apply:${room.id}`)
      .setPlaceholder(`선뽑: 1명 선택`)
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(options);
    const row = new ActionRowBuilder().addComponents(menu);
    return interaction.reply({
      ephemeral: true,
      content: `선뽑: 1명을 선택하세요.`,
      components: [row],
    });
  }

  // 선픽 이후: 현재 턴 검증하고, 그 턴의 요구 수만큼 선택
  if (!ensureActivePicker(interaction, room)) return;

  const step = room.currentPickStep();
  if (!step || isPickFinished(room)) {
    return interaction.reply({ ephemeral: true, content: '이미 픽이 완료되었습니다.' });
  }
  if (rem.length === 0)
    return interaction.reply({
      ephemeral: true,
      content: `선택할 선수가 없습니다.`,
    });
  // if (rem.length === 0) return ephemeralToast(interaction, '지명할 선수가 없습니다.');

  // 마지막 1명 자동배정 케이스 선처리
  if (rem.length === 1 && step.count === 1) {
    await maybeAutoAssignIfOneLeft(interaction, room);
    const lobbyMsg = await fetchRoomMessage(interaction, room);
    await interaction.reply({
      ephemeral: true,
      content: `남은 1명은 자동 배정되었습니다.`,
    });
    // await ephemeralToast(interaction, '남은 1명은 자동 배정되었습니다.');
    return lobbyMsg.edit(buildDraftPickMessage(room));
  }

  const options = rem.map((p) => ({
    label: `${p.tierStr ?? ""} ${p.nameTag ?? p.userId}`.trim(),
    value: p.userId,
  }));

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`pg_pick_apply:${room.id}`)
    .setPlaceholder(`${step.team}팀 ${step.count}명 선택`)
    .setMinValues(step.count)
    .setMaxValues(step.count)
    .addOptions(options);

  const row = new ActionRowBuilder().addComponents(menu);
  return interaction.reply({
    ephemeral: true,
    content: `${step.team}팀: ${step.count}명을 선택하세요.`,
    components: [row],
  });
}

async function pickApply(interaction, room) {
  const values = interaction.values || [];

  // ⬇️ 선픽 미정 상태에서의 제출: 이때 선픽 확정 + 1명 지명
  if (!isPickStarted(room)) {
    // 선픽은 팀장만 가능(호스트가 선픽 강제하지 못하게)
    const uid = interaction.user.id;
    const actorTeam =
      room.captainA?.userId === uid ? 'A' :
      room.captainB?.userId === uid ? 'B' : null;
  if (!actorTeam) {
    return interaction.reply({ ephemeral: true, content: '선픽은 팀장만 할 수 있어요.' });
  }
  if (values.length !== 1) {
    return interaction.reply({ ephemeral: true, content: '선픽은 1명만 선택할 수 있어요.' });
  }
    // 유효성(아직 남아 있는지) 재확인
  const remIds = new Set(remainingSorted(room).map(p => p.userId));
  if (!remIds.has(values[0])) {
    return interaction.reply({ ephemeral: true, content: '이미 다른 팀에 배정되었거나 잘못된 선택입니다. 다시 시도해주세요.' });
  }
    // 선픽 확정 + 첫 픽 적용
    room.initPickOrderBy(actorTeam);
    room.addToTeam(actorTeam, [values[0]]);
    room.pickTurnIdx = 1; // 첫 턴(1명) 소비 완료
    await interaction.update({ content: '선픽이 확정되고 1명이 배정되었습니다.', components: [] });
    const lobbyMsg = await fetchRoomMessage(interaction, room);
    return lobbyMsg.edit(buildDraftPickMessage(room));
  }

  // ⬇️ 선픽 이후: 현재 턴 팀장/개최자만, 요구 수 일치해야 함
  if (!ensureActivePicker(interaction, room)) return;
  const step = room.currentPickStep();
  if (!step || isPickFinished(room)) {
    return interaction.reply({ ephemeral: true, content: '이미 픽이 완료되었습니다.' });
  }
  if (values.length !== step.count) {
    return interaction.reply({ ephemeral: true, content: `지금은 **${step.count}명**을 지명해야 합니다.` });
  }

  // 아직 남아 있는 후보인지 다시 검증 (경쟁 상태 방지)
  const remIds = new Set(remainingSorted(room).map(p => p.userId));
  for (const v of values) {
    if (!remIds.has(v)) {
      return interaction.reply({ ephemeral: true, content: '이미 다른 팀에 배정되었거나 잘못된 선택입니다. 다시 시도해주세요.' });
    }
  }

  // 적용
  room.addToTeam(step.team, values);
  room.pickTurnIdx += 1;

  // 에페메랄 UI 닫기
  await interaction.update({ content: '뽑기가 완료되었습니다.', components: [] });

  // 남은 1명 자동배정(다음 턴이 1명 요구이면)
  await maybeAutoAssignIfOneLeft(interaction, room);

  const lobbyMsg = await fetchRoomMessage(interaction, room);
if (room.isTeamsFull) {
  // 팀이 모두 찼으면 4단계 화면으로 전환
  return lobbyMsg.edit(buildMatchMessage(room));
 }
  return lobbyMsg.edit(buildDraftPickMessage(room));
}

module.exports = { open, dice, pickOpen, pickChoose, pickApply };
