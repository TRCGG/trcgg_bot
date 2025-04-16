const { Events } = require("discord.js");
const guildService = require("../services/guildService");
const selectBoxUtils = require("../utils/selectBoxUtils");

/**
 * interactionCreate 이벤트 핸들러
 */

module.exports = {
	name: Events.InteractionCreate,
	once: false,
	async execute(client, interaction) {
		if (!interaction.isStringSelectMenu()) return;
		if (interaction.customId === "select_language") {
			const selected = interaction.values[0]; // 선택한 값
			const guild_id = interaction.guild.id; // 길드 ID
			const lang = selected; // 선택한 언어

			const result = await guildService.put_guild_lang(lang, guild_id); // 길드 언어 설정 API 호출

			await interaction.reply(result); // 결과 메시지 전송

			const disabled_message = await selectBoxUtils.disabled_message(interaction); // 선택 완료 메시지 전송

			
		}
	},
};
