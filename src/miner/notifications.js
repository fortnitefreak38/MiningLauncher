const axios = require('axios');

class Notifier {
  constructor(config) {
    this.cfg = config;
  }

  async sendTelegram(msg) {
    const { enabled, botToken, chatId } = this.cfg.telegram;
    if (!enabled || !botToken || !chatId) return;
    try {
      await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        chat_id: chatId,
        text: msg,
        parse_mode: 'Markdown',
      });
    } catch {}
  }

  async sendDiscord(msg) {
    const { enabled, webhookUrl } = this.cfg.discord;
    if (!enabled || !webhookUrl) return;
    try {
      await axios.post(webhookUrl, { content: msg });
    } catch {}
  }

  async send(msg) {
    await Promise.all([this.sendTelegram(msg), this.sendDiscord(msg)]);
  }
}

module.exports = { Notifier };
