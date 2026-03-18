import nodemailer from "nodemailer";

export default class EmailService {
  constructor(smtpConfig) {
    this.config = smtpConfig;
  }

  // ADDED: ccRecipients parameter
  async sendInvoice(recipients, ccRecipients, attachments, subject, textBody) {
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

      const mailOptions = {
        from: `"BioTechnique PO System" <${this.config.fromEmail}>`,
        to: recipients.join(", "),
        subject: subject,
        text: textBody,
        attachments: attachments,
      };

      // If CC recipients exist, add them to the email configuration
      if (ccRecipients && ccRecipients.length > 0) {
        mailOptions.cc = ccRecipients.join(", ");
      }

      const info = await transporter.sendMail(mailOptions);
      console.log("Email sent successfully. Message ID:", info.messageId);
    } catch (error) {
      console.error("Email sending failed:", error.message);
      if (error.response) {
        console.error("SMTP Response:", error.response);
      }
    }
  }
}
