const httpClient = require('../utils/networkUtils');
const prefix = '/statistics';
const season = process.env.SEASON || "2025";

const get_master_of_champion_record = async (champName, guildId) => {
  const queryString = new URLSearchParams({
    championName: champName,
    position: "ALL",
    datePreset: "season",
    season,
  });
  const url = `${prefix}/${guildId}/users`;

  return httpClient.get(`${url}?${queryString.toString()}`, {}, { guildId });
}

const get_champion_statistics = async (guildId, options = {}) => {
  const queryString = new URLSearchParams({
    datePreset: "season",
    season,
    limit: options.limit || 1000,
  });

  if (options.position) queryString.append("position", options.position);

  const url = `${prefix}/${guildId}/champions`;

  return httpClient.get(`${url}?${queryString.toString()}`, {}, { guildId });
}

/**
 * @description !클랜통계
 */
const get_user_data = async (seasonArg, month, guildId) => {
  const queryString = new URLSearchParams({
    limit: 1000,
    season: seasonArg || season,
  });

  if (month) {
    queryString.append("datePreset", "range");
    queryString.append("fromMonth", month);
    queryString.append("toMonth", month);
  } else {
    queryString.append("datePreset", "season");
  }

  const url = `${prefix}/${guildId}/users`;

  return httpClient.get(`${url}?${queryString.toString()}`, {}, { guildId });
}

module.exports = {
  get_master_of_champion_record,
  get_champion_statistics,
  get_user_data,
}
