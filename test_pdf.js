import fs from "fs";
import InvoiceGenerator from "./services/invoice_generator.js";

async function testPdfSuite() {
  console.log("--> Starting Consolidated PDF Test Suite...");
  const generator = new InvoiceGenerator();

  // ============================================================
  // TEST CASE: Client Invoice (Consolidated Example)
  // This uses a mix of internal/external mock data to simulate your setup
  // ============================================================
  const mockConsolidatedInvoice = {
    id: "22980",
    attributes: {
      pkey: "BTPO-000205",
      cf_po_type: "External", // Or "Internal", the generator handles both!

      // Header Dates & Terms
      cf_date_client_invoice: "2025-11-20T00:00:00+00:00",
      cf_due_date_client_invoice: "2026-01-09T00:00:00+00:00",
      cf_po_number: "64-GGYBK-0226",
      cf_invoice_payment_term: "45 days",

      // Invoice To
      cf_client: "Pharma Industria",
      cf_client_address_crm: "123 Avenue",
      cf_address_city: "Cityville",
      cf_address_state: "NCR",
      cf_address_zip: "1000",
      cf_address_country: "Philippines",

      // Ship To
      cf_receiving_company: "BioTechnique LLC",
      cf_shipping_address: "250 Cross Farm Lane",
      cf_ship_to_city: "York",
      cf_ship_to_state: "PA",
      cf_ship_to_zip: "17406",
      cf_ship_to_country: "USA",

      cf_project_psc: "Winter Sonata",

      // Items array mocking both int & ext part numbers
      cf_items_btpo_api2: JSON.stringify([
        {
          values: {
            cf_item_desc_ext: "Material D",
            cf_item_part_num_int: "BT-061-CCM",
            cf_item_part_num_ext: "0125800",
            cf_order_qty_ext: "3.5",
            cf_uom_ext: "Lbs",
            cf_price_per_unit_ext: "96.30",
            cf_dollar_amount_external: "337.05",
          },
        },
        {
          values: {
            cf_item_desc_ext: "Material C",
            cf_item_part_num_int: "BT-062-CCM",
            cf_item_part_num_ext: "0125801",
            cf_order_qty_ext: "1",
            cf_uom_ext: "ea",
            cf_price_per_unit_ext: "233.14",
            cf_dollar_amount_external: "233.14",
          },
        },
      ]),

      // Totals
      cf_subtotal_external: "570.19",
      cf_tax_external: "17.08",
      cf_shipping_n_handling_external: "25.66",
      cf_tariffs: "6.32", // Newly added map logic!
      cf_others_external: "0.00",
      cf_discount_ext: "0.00",
      cf_additional_handling_ext: "59.59",
      cf_total_w_handlingfe: "678.84",
    },
  };

  try {
    // GENERATE: CONSOLIDATED INVOICE
    console.log("Generating Consolidated Invoice PDF...");
    const pdfBuffer = await generator.generate(
      mockConsolidatedInvoice,
      "INVOICE",
    );
    fs.writeFileSync("output_consolidated_invoice.pdf", pdfBuffer);
    console.log("✅ Saved: output_consolidated_invoice.pdf");

    console.log(
      "\nTest complete. You should see only the consolidated PDF now.",
    );
  } catch (error) {
    console.error("❌ Error generating PDFs:", error);
  }
}

testPdfSuite();
