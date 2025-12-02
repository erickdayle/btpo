import config from "./config/index.js";
import AceApiService from "./services/ace_api.js";
import EmailService from "./services/email_service.js";
import PurchaseOrderProcessor from "./services/purchase_order_processor.js";

async function main() {
  const recordId = process.argv[2];
  if (!recordId) {
    console.error("Error: recordId required");
    process.exit(1);
  }

  // Dependency Injection
  const apiService = new AceApiService(config);
  const emailService = new EmailService(config.smtp);

  const processor = new PurchaseOrderProcessor(
    apiService,
    emailService,
    config
  );

  try {
    await processor.process(recordId);
    console.log("Job Complete");
  } catch (err) {
    console.error("Job Failed:", err);
    process.exit(1);
  }
}

main();
