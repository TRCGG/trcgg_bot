const { Events } = require("discord.js");
const { handleRecruitInteraction } = require("../services/recruitService");

/**
 * interactionCreate 이벤트 핸들러
 */

module.exports = {
	name: Events.InteractionCreate,
	once: false,
	async execute(_client, interaction) {
		await handleRecruitInteraction(interaction);
	},
};
