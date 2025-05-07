const httpClient = require("../utils/networkUtils");
const prefix = "/championship";

const post = async (data, guild_id) => {
  const url = `${prefix}/${guild_id}`;
  return httpClient.post(url, data);
}

module.exports = {
  post,
};