class BotError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'BotError';
    this.status = status;
    Object.setPrototypeOf(this, BotError.prototype);
  }
}

module.exports = { BotError };
