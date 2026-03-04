const { Events } = require("discord.js");
const { handleSelectMenuInteraction } = require("../utils/selectBoxUtils");
const { handleScheduleSelectInteraction } = require("../utils/scheduleSelectInteraction");
const { handleScheduleModalInteraction } = require("../utils/scheduleModalInteraction");

/**
 * interactionCreate 이벤트 핸들러
 */

module.exports = {
	name: Events.InteractionCreate,
	once: false,
	async execute(client, interaction) {
		if (await handleSelectMenuInteraction(interaction)) return;
		if (await handleScheduleSelectInteraction(interaction)) return;
		if (await handleScheduleModalInteraction(interaction, client)) return;
	},
};
