
/**
 * common 명령어 실행
 */
const command = {
  async execute (service, method, msg, args) {
    try {
      const result = await service[method](msg, args);
      msg.reply(result);
    } catch (err) {
      console.log(`command error ${service} ${method} `,err);
      msg.reply(err.message);
    }
  },
}

module.exports = command;