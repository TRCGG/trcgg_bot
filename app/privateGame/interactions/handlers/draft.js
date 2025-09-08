const {
  ensureHostOrCaptain, ensureActivePicker,
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
  await interaction.reply({ephemeral: true, content: `지명 단계로 이동했습니다`});
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
  // 아직 선픽 미정이면: "클릭한 팀장"이 선픽 확정 + 1명 지명 턴
  if (!room.pickOrder || room.pickOrder.length === 0) {
    const uid = interaction.user.id;
    let actorTeam = null;
    if (room.captainA?.userId === uid) actorTeam = "A";
    if (room.captainB?.userId === uid) actorTeam = "B";
    if (!actorTeam) {
      return interaction.reply({
        ephemeral: true,
        content: "선픽 시작은 팀장만 할 수 있어요.",
      });
    }
    room.initPickOrderBy(actorTeam); // ✅ 선픽 확정
  } else {
    // 선픽 확정 이후엔 기존 가드 적용(현재 턴의 팀장 or 개최자)
    if (!ensureActivePicker(interaction, room)) return;
  }

  const step = room.currentPickStep();
  if (!step)
    return interaction.reply({
      ephemeral: true,
      content: "이미 픽이 완료되었습니다.",
    });
  if (rem.length === 0)
    return interaction.reply({
      ephemeral: true,
      content: `지명할 선수가 없습니다.`,
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
    .setPlaceholder(`${step.team}팀 ${step.count}명 지명`)
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
  // 턴/권한 재확인 (동시 클릭 대비)
  if (!ensureActivePicker(interaction, room)) return;

  const step = room.currentPickStep();
  if (!step) return interaction.reply({ephemeral: true, content: `이미 픽이 완료되었습니다.`});
  // if (!step) return ephemeralToast(interaction, '이미 픽이 완료되었습니다.');

  const values = interaction.values || [];
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
  await interaction.update({ content: '지명이 완료되었습니다.', components: [] });

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
