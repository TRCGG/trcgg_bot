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

  return httpClient.get(`${url}?${queryString.toString()}`);
}

const get_champion_statistics = async (guildId, options = {}) => {
  const queryString = new URLSearchParams({
    datePreset: "season",
    season,
    limit: options.limit || 1000,
  });

  if (options.position) queryString.append("position", options.position);

  const url = `${prefix}/${guildId}/champions`;

  return httpClient.get(`${url}?${queryString.toString()}`);
}

/**
 * @description !클랜통계
 */
const get_user_data = async (year, month, guildId) => {
  const queryString = new URLSearchParams({ limit: 200, season: season });
  if (year) queryString.append("year", year);
  if (month) queryString.append("month", month);
  const url = `${prefix}/${guildId}/users`;

  return httpClient.get(`${url}?${queryString.toString()}`);
}

module.exports = {
  get_master_of_champion_record,
  get_champion_statistics,
  get_user_data,
}
