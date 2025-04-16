
/**
 * common 명령어 실행
 */
const command = {
  // 명령어 실행
  async exec (service, method, client, msg, args) {
    try {
      await service[method](client, msg, args);
    } catch (err) {
      console.log(`command error ${service} ${method} `,err);
    }
  },
  // 명령어 실행 후 msg 응답
  async execute (service, method, msg, args) {
    try {
      const result = await service[method](msg, args);
      msg.reply(result);
    } catch (err) {
      console.log(`command error ${service} ${method} `,err);
      msg.reply(err.message);
    }
  },

  // 명령어 실행 후 msg 응답 (client 포함)
  async executeWithClient (service, method, client, msg, args) {
    try {
      const result = await service[method](client, msg, args);
      msg.reply(result);
    } catch (err) {
      console.log(`command error ${service} ${method} `,err);
      msg.reply(err.message);
    }
  },
}

module.exports = command;