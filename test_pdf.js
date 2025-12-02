import fs from "fs";
import InvoiceGenerator from "./invoice_generator.js";

async function testPdfSuite() {
  console.log("--> Starting PDF Test Suite...");
  const generator = new InvoiceGenerator();

  // ============================================================
  // TEST CASE 1: Internal PO (Vendor: W.W. Grainger)
  // Ref: BTPO-000306_To send to VENDOR (Internal PO).pdf
  // ============================================================
  const mockInternalPO = {
    id: "22982",
    attributes: {
      pkey: "BTPO-000306",
      cf_po_type: "Internal", // Triggers Internal Logic

      // Header
      cf_quote_number: "test",
      cf_payment_terms: "30 days",

      // Supplier
      cf_supplier_company_nam: "W.W. Grainger, Inc. - NOT APPROVED",
      cf_address_of_supplier: "501 Atlas Ave.",
      cf_supplier_city: "Madison",
      cf_supplier_state: "WI",
      cf_supplier_zip: "53714-3107",
      cf_supplier_country: "United States of America",

      // Ship To
      cf_receiving_company: "BioTechnique",
      cf_shipping_address: "5501 Research Park Boulevard",
      cf_ship_to_city: "Madison",
      cf_ship_to_state: "WI",
      cf_ship_to_zip: "53719",
      cf_ship_to_country: "United States of America",

      // Bill To
      cf_bill_to_company: "BioTechnique LLC",
      cf_billing_address: "700 Corporate Center Drive",
      cf_bill_to_city: "Pomona",
      cf_bill_to_state: "CA",
      cf_bill_to_zip: "91768",
      cf_bill_to_country: "USA",

      // Items (Internal Table)
      cf_items_btpo: JSON.stringify([
        {
          values: {
            cf_item_desc_int: "Item 1",
            cf_order_qty_int: "1",
            cf_uom_int: "ea",
            cf_price_per_unit_int: "562.35",
            cf_dollar_amount_internal: "562.35",
          },
        },
        {
          values: {
            cf_item_desc_int: "Item 2",
            cf_order_qty_int: "10",
            cf_uom_int: "pcs",
            cf_price_per_unit_int: "75.86",
            cf_dollar_amount_internal: "758.60",
          },
        },
        {
          values: {
            cf_item_desc_int: "Item 3",
            cf_order_qty_int: "1",
            cf_uom_int: "",
            cf_price_per_unit_int: "25.00",
            cf_dollar_amount_internal: "25.00",
          },
        },
      ]),

      // Totals (Internal Fields)
      cf_subtotal_n: "1345.95",
      cf_tax_c: "5.68",
      cf_shipping_n_handling_c: "15.20",
      cf_others_c: "0.00",
      cf_discount_int: "10.00",
      cf_total_ca: "1356.83",
    },
  };

  // ============================================================
  // TEST CASE 2: External PO (Vendor: Alpha Lab Instruments)
  // Ref: BTPO-000205_To send to VENDOR (External PO).pdf
  // ============================================================
  const mockExternalPO = {
    id: "22980",
    attributes: {
      pkey: "BTPO-000205",
      cf_po_type: "External", // Triggers External Logic

      // Header
      cf_quote_number: "test",
      cf_payment_terms: "Paid upon order",

      // Supplier
      cf_supplier_company_nam: "Alpha Lab Instruments",
      cf_address_of_supplier: "92 Olive Avenue",
      cf_supplier_city: "Athena Park",
      cf_supplier_state: "ML",
      cf_supplier_zip: "1000",
      cf_supplier_country: "PHL",

      // Ship To
      cf_receiving_company: "BioTechnique LLC",
      cf_shipping_address: "250 Cross Farm Lane",
      cf_ship_to_city: "York",
      cf_ship_to_state: "PA",
      cf_ship_to_zip: "17406",
      cf_ship_to_country: "USA",

      // Bill To
      cf_bill_to_company: "BioTechnique LLC",
      cf_billing_address: "250 Cross Farm Lane",
      cf_bill_to_city: "York",
      cf_bill_to_state: "PA",
      cf_bill_to_zip: "17406",
      cf_bill_to_country: "USA",

      // Items (External Table)
      cf_items_btpo_api2: JSON.stringify([
        {
          values: {
            cf_item_desc_ext: "Item 1",
            cf_order_qty_ext: "1",
            cf_uom_ext: "",
            cf_price_per_unit_ext: "484.24",
            cf_dollar_amount_external: "484.24",
          },
        },
      ]),

      // Totals (External Fields)
      cf_subtotal_external: "484.24",
      cf_tax_external: "12.56",
      cf_shipping_n_handling_external: "2.36",
      cf_others_external: "0.00",
      cf_discount_ext: "18.75",
      cf_total_btpo: "480.41",
    },
  };

  // ============================================================
  // TEST CASE 3: Client Invoice (Client: Pharma Industria)
  // Ref: BTPO-000205_To send to CLIENT (Invoice).pdf
  // ============================================================
  const mockClientInvoice = {
    id: "22980", // Same record ID as External PO usually
    attributes: {
      pkey: "BTPO-000205",

      // Header Dates & Terms
      cf_date_client_invoice: "2025-11-20T00:00:00+00:00",
      cf_due_date_client_invoice: "2026-01-09T00:00:00+00:00",
      cf_po_number: "64-GGYBK-0226", // Customer PO Number
      cf_invoice_payment_term: "45 days",

      // Invoice To (Client)
      cf_client: "Pharma Industria",
      cf_client_address_crm: "123 Avenue",
      cf_address_city: "Cityville",
      cf_address_state: "NCR",
      cf_address_zip: "1000",
      cf_address_country: "Philippines",

      // Ship To (BioTechnique)
      cf_receiving_company: "BioTechnique LLC",
      cf_shipping_address: "250 Cross Farm Lane",
      cf_ship_to_city: "York",
      cf_ship_to_state: "PA",
      cf_ship_to_zip: "17406",
      cf_ship_to_country: "USA",

      // Project
      cf_project_psc: "Winter Sonata",

      // Items (External Table - Same as External PO)
      cf_items_btpo_api2: JSON.stringify([
        {
          values: {
            cf_item_desc_ext: "Item 1",
            cf_order_qty_ext: "1",
            cf_uom_ext: "",
            cf_price_per_unit_ext: "484.24",
            cf_dollar_amount_external: "484.24",
          },
        },
      ]),

      // Totals (External Fields + Handling Fee)
      cf_subtotal_external: "484.24",
      cf_tax_external: "12.56",
      cf_shipping_n_handling_external: "2.36",
      cf_others_external: "0.00",
      cf_discount_ext: "18.75",
      cf_additional_handling_ext: "46.79",
      cf_total_w_handlingfe: "527.20", // Invoice Total
    },
  };

  try {
    // GENERATE 1: INTERNAL PO
    console.log("Generating 1. Internal PO PDF...");
    const pdfBuffer1 = await generator.generate(mockInternalPO, "PO");
    fs.writeFileSync("output_1_internal_po.pdf", pdfBuffer1);
    console.log("✅ Saved: output_1_internal_po.pdf");

    // GENERATE 2: EXTERNAL PO
    console.log("Generating 2. External PO PDF...");
    const pdfBuffer2 = await generator.generate(mockExternalPO, "PO");
    fs.writeFileSync("output_2_external_po.pdf", pdfBuffer2);
    console.log("✅ Saved: output_2_external_po.pdf");

    // GENERATE 3: CLIENT INVOICE
    console.log("Generating 3. Client Invoice PDF...");
    const pdfBuffer3 = await generator.generate(mockClientInvoice, "INVOICE");
    fs.writeFileSync("output_3_client_invoice.pdf", pdfBuffer3);
    console.log("✅ Saved: output_3_client_invoice.pdf");

    console.log(
      "\nAll tests completed. Please check the 3 output files in your folder."
    );
  } catch (error) {
    console.error("❌ Error generating PDFs:", error);
  }
}

testPdfSuite();
