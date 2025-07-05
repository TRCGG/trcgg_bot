// inhouse.buttons.js
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

/**
 * @param {*} param0 
 * @description 내전 신청 버튼을 생성합니다.
 * @returns 
 */

function createInhouseButtons({undoEnabled = false} = {}) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('inhouse_apply')
      .setLabel('✅ 신청하기')
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId('inhouse_cancel')
      .setLabel('❌ 본인 취소')
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId('mention_range')
      .setLabel('💬 대기자호출')
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId('cancel_range')
      .setLabel('🗑️ 대기자정리')
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId('inhouse_priority')
      .setLabel('⭐ 우선예약')
      .setStyle(ButtonStyle.Primary),

    // new ButtonBuilder()
    //   .setCustomId('inhouse_undo')
    //   .setLabel('↩ 되돌리기')
    //   .setStyle(ButtonStyle.Secondary)
    //   .setDisabled(!undoEnabled) // Undo 버튼 활성화 여부 설정

  );
}

module.exports = { createInhouseButtons };