import nodemailer from "nodemailer";

export default class EmailService {
  constructor(smtpConfig) {
    this.config = smtpConfig;
  }

  /**
   * Sends the email with the attached PDF.
   * @param {Array} recipients - List of email strings
   * @param {Buffer} pdfBuffer - The PDF file buffer
   * @param {string} subject - Email Subject Line
   * @param {string} textBody - Email Body Text
   */
  async sendInvoice(recipients, pdfBuffer, subject, textBody) {
    if (!this.config.host) {
      console.warn("SMTP Config missing. Email skipped.");
      return;
    }

    // Port 465 (Gmail) requires secure: true
    // Port 587 (Outlook) requires secure: false
    const isSecure = this.config.port === 465;

    const transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: isSecure,
      auth: {
        user: this.config.user,
        pass: this.config.pass,
      },
    });

    console.log(
      `Attempting to send email via ${this.config.host}:${this.config.port}...`
    );

    try {
      const info = await transporter.sendMail({
        from: `"BioTechnique PO System" <${this.config.user}>`,
        to: recipients.join(", "),
        subject: subject,
        text: textBody, // <--- Now uses the dynamic template
        attachments: [
          {
            filename: "Invoice.pdf",
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ],
      });
      console.log("Email sent successfully. Message ID:", info.messageId);
    } catch (error) {
      console.error("Email sending failed:", error.message);
    }
  }
}
