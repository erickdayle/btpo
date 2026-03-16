import nodemailer from "nodemailer";

export default class EmailService {
  constructor(smtpConfig) {
    this.config = smtpConfig;
  }

  async sendInvoice(recipients, attachments, subject, textBody) {
    if (!this.config.host) {
      console.warn("SMTP Config missing. Email skipped.");
      return;
    }

    const isSecure = this.config.port === 465;

    const authConfig = {
      user: this.config.user,
      pass: this.config.pass,
    };

    const transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: isSecure,
      auth: authConfig,
      tls: {
        ciphers: "SSLv3",
      },
    });

    try {
      console.log(
        `Attempting to send email via ${this.config.host}:${this.config.port} to ${recipients.length} recipients...`,
      );

      const info = await transporter.sendMail({
        from: `"Biotechnique Invoicing" <${this.config.fromEmail}>`,
        to: recipients.join(", "),
        subject: subject,
        text: textBody,
        attachments: attachments,
      });
      console.log("Email sent successfully. Message ID:", info.messageId);
    } catch (error) {
      console.error("Email sending failed:", error.message);
      if (error.response) {
        console.error("SMTP Response:", error.response);
      }
    }
  }
}
