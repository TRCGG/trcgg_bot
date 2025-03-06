const recordClient = require('../client/recordClient');
const stringUtils = require('../utils/stringUtils');
/**
 * 전적 api call service
 */

/**
 * @param {*} msg
 * @param {*} args
 * @description !전적 조회에 필요한 모든 데이터 조회
 */
const get_all_record_embed = async(msg, args) => {
  const [riot_name, riot_name_tag] = stringUtils.getMemberNick(msg, args);
  const guild_id = msg.guild.id;
  const embed = await recordClient.get_all_record(riot_name, riot_name_tag, guild_id);
  console.log(embed);
  return stringUtils.createEmbed(embed);
}

/**
 * @param {*} msg
 * @param {*} args
 * @description !최근 게임 조회
 */ 
const get_recent_record_embed = async(msg, args) => {
  const [riot_name, riot_name_tag] = stringUtils.getMemberNick(msg, args);
  const guild_id = msg.guild.id;
  const embed = await recordClient.get_recent_record(riot_name, riot_name_tag, guild_id);
  return stringUtils.createEmbed(embed);
}

/**
 * @param {*} msg
 * @param {*} args
 * @description !장인 Embed
 * @returns
 */
const get_master_record_embed = async(msg, args) => {
  const champ_name = args.join(" ").replace(/\s/g, "").trim();
  const guild_id = msg.guild.id;
  const embed = await recordClient.get_master_record(champ_name, guild_id);
  return stringUtils.createEmbed(embed);
}

/**
 * @param {*} msg
 * @param {*} args
 * @description !통계 챔프 Embed
 * @returns
 */
const get_champstat_record_embed = async(msg, args) => {
  const [ year, month ] = stringUtils.splitDate(args);
  const guild_id = msg.guild.id;
  const embed = await recordClient.get_champstat_record(year, month, guild_id);
  return stringUtils.createEmbed(embed)
}

/**
 * @param {*} msg
 * @param {*} args
 * @description !통계 게임 Embed
 * @returns
 */
const get_gamestat_record_embed = async(msg, args) => {
  const [ year, month ] = stringUtils.splitDate(args);
  const guild_id = msg.guild.id;
  const embed = await recordClient.get_gamestat_record(year, month, guild_id);
  return stringUtils.createEmbed(embed);
}

/**
 * @param {*} msg
 * @param {*} args
 * @description !라인 {탑/정글/미드/원딜/서폿} Embed
 * @returns
 */
const get_linestat_record_embed = async(msg, args) => {
  const position = args.join(" ").replace(/\s/g, "").trim();
  const guild_id = msg.guild.id;
  const embed = await recordClient.get_linestat_record(position, guild_id);
  return stringUtils.createEmbed(embed)
}

/**
 * @param {*} msg
 * @param {*} args
 * @description !결과 Embed
 * @returns
 */
const get_result_record_embed = async(msg, args) => {
  const game_id = args.join(" ");
  const guild_id = msg.guild.id;
  const embed = await recordClient.get_result_record(game_id, guild_id);
  return stringUtils.createEmbed(embed);
}

/**
 * @param {*} msg
 * @param {*} args
 * @description !클랜통계 Embed
 * @returns
 */
const get_clanstat_record_embed = async(msg, args) => {
  const date = args.join(" ");
  const [ year, month ] = stringUtils.splitDate(date);
  const guild_id = msg.guild.id;
  const str = await recordClient.get_clanstat_record(year, month, guild_id);

  const rows = str.split('\n');
  // 2000자 제한
  const maxLength = 2000;
  let currentMessage = '';
  // 2000자 넘을경우 끊어서 reply 
  rows.forEach(row => {
    if (currentMessage.length + row.length + 1 <= maxLength) {  
      currentMessage += row + '\n';
    } else {
      msg.reply(currentMessage);
      currentMessage = row + '\n';  
    }
  });

  if (currentMessage.length > 0) {
    msg.reply(currentMessage);
  }
}

module.exports = {
  get_all_record_embed,
  get_recent_record_embed,
  get_master_record_embed,
  get_champstat_record_embed,
  get_gamestat_record_embed,
  get_linestat_record_embed,
  get_result_record_embed,
  get_clanstat_record_embed,
}






