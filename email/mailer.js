// email/mailer.js — placeholder minimal for Phase 3
export default {
  async sendAlertEmail(to, payload) {
    // In real build, integrate with your SMTP. Here we just log.
    console.log("[mailer] sendAlertEmail ->", to, payload.title);
    return true;
  }
};
