import "dotenv/config";
import PurchaseOrderProcessor from "./purchase_order_processor.js";

async function main() {
  // 1. Log immediately to prove the script is running
  console.log("--> Script started...");

  const recordId = process.argv[2];
  const projectId = process.argv[3];

  if (!recordId) {
    console.error("Error: recordId is a required argument.");
    process.exit(1);
  }

  console.log(`--> Processing Record ID: ${recordId}`);

  // 2. Validate Env Vars
  if (
    !process.env.TABLE_FIELD_ID_INTERNAL ||
    !process.env.TABLE_FIELD_ID_EXTERNAL
  ) {
    console.error(
      "Error: Missing TABLE_FIELD_ID_INTERNAL or TABLE_FIELD_ID_EXTERNAL in .env"
    );
    process.exit(1);
  }

  if (!process.env.ACE_API_BASE_URL || !process.env.ACE_API_TOKEN) {
    console.error("Error: Missing ACE_API_BASE_URL or ACE_API_TOKEN in .env");
    process.exit(1);
  }

  try {
    const processor = new PurchaseOrderProcessor(
      process.env.ACE_API_BASE_URL,
      process.env.ACE_API_TOKEN,
      process.env.TABLE_FIELD_ID_INTERNAL,
      process.env.TABLE_FIELD_ID_EXTERNAL
    );

    console.log("--> Processor initialized, starting update...");
    await processor.processRecordUpdate(recordId);
    console.log("--> Script finished successfully.");
  } catch (error) {
    console.error("Error during script execution:", error.message);
    process.exit(1);
  }
}

// CRITICAL: This line must be here to run the function!
main();
