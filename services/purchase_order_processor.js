import InvoiceGenerator from "./invoice_generator.js";

export default class PurchaseOrderProcessor {
  constructor(apiService, emailService, config) {
    this.api = apiService;
    this.email = emailService;
    this.config = config;
  }

  async process(recordId) {
    console.log(`Processing Record: ${recordId}`);

    // 1. Get Data
    let recordData = await this.api.getRecordMeta(recordId);

    // 2. Calculations (Internal/External Tables)
    const updates = await this._calculateTotals(
      recordId,
      recordData.attributes
    );

    if (Object.keys(updates).length > 0) {
      await this.api.updateRecord(recordId, updates);
      // Refresh data for PDF generation so it has the new totals
      recordData = await this.api.getRecordMeta(recordId);
    } else {
      console.log("No subtotal updates required.");
    }

    // 3. Enrich Data (Resolve IDs to Names)
    await this._enrichData(recordData.attributes);

    // 4. Generate & Send Email
    await this._handleEmail(recordId, recordData);
  }

  // --- CALCULATION LOGIC ---
  async _calculateTotals(recordId, attrs) {
    const updates = {};

    // Internal Table
    if (attrs.cf_items_btpo) {
      const res = await this._processTable(
        recordId,
        this.config.tables.internalId,
        attrs.cf_items_btpo,
        {
          qty: "cf_order_qty_int",
          price: "cf_price_per_unit_int",
          amount: "cf_dollar_amount_internal",
          desc: "cf_item_desc_int",
          uom: "cf_uom_int",
          part: "cf_item_part_num_int",
        }
      );
      if (res.shouldUpdate) updates.cf_subtotal_n = res.subtotal;
    }

    // External Table
    if (attrs.cf_items_btpo_api2) {
      const res = await this._processTable(
        recordId,
        this.config.tables.externalId,
        attrs.cf_items_btpo_api2,
        {
          qty: "cf_order_qty_ext",
          price: "cf_price_per_unit_ext",
          amount: "cf_dollar_amount_external",
          desc: "cf_item_desc_ext",
          uom: "cf_uom_ext",
          part: "cf_item_part_num_ext",
        }
      );
      if (res.shouldUpdate) updates.cf_subtotal_external = res.subtotal;
    }

    return updates;
  }

  async _processTable(recordId, tableId, tableStr, keys) {
    let rows = [];
    try {
      rows = JSON.parse(tableStr);
    } catch (e) {
      return { shouldUpdate: false };
    }
    if (!Array.isArray(rows) || rows.length === 0)
      return { shouldUpdate: false };

    let subtotal = 0;
    const rowsToUpdate = [];

    rows.forEach((row) => {
      const v = row.values || {};
      const qty = parseFloat(v[keys.qty]) || 0;
      const price = parseFloat(v[keys.price]) || 0;
      const currentAmt = parseFloat(v[keys.amount]) || 0;

      const newAmt = qty * price;
      subtotal += newAmt;

      if (newAmt.toFixed(2) !== currentAmt.toFixed(2)) {
        const updateRow = {
          [keys.amount]: newAmt.toFixed(2),
          [keys.qty]: v[keys.qty],
          [keys.price]: v[keys.price],
          [keys.desc]: v[keys.desc],
          [keys.uom]: v[keys.uom],
        };
        if (v[keys.part]) updateRow[keys.part] = v[keys.part];
        rowsToUpdate.push({ name: row.name, values: updateRow });
      }
    });

    if (rowsToUpdate.length > 0) {
      await this.api.updateTable(recordId, tableId, rowsToUpdate);
      return { shouldUpdate: true, subtotal: subtotal.toFixed(2) };
    }
    return { shouldUpdate: true, subtotal: subtotal.toFixed(2) };
  }

  // --- ENRICHMENT LOGIC ---
  async _enrichData(attrs) {
    console.log("Resolving Reference Data...");
    const oids = this.config.objects;

    const objectLookups = [
      {
        field: "cf_client",
        method: "searchGroup",
        aql: (id) => `select name from __main__ where id eq ${id}`,
      },
      {
        field: "cf_department_btop",
        method: "searchObject",
        args: [oids.department],
        aql: (id) => `SELECT name FROM __main__ where id eq ${id}`,
      },
      {
        field: "cf_project_psc",
        method: "searchObject",
        args: [oids.project],
        aql: (id) => `SELECT name FROM __main__ where id eq ${id}`,
      },
      {
        field: "cf_supplier_company_nam",
        method: "searchObject",
        args: [oids.supplier],
        aql: (id) => `SELECT name FROM __main__ where id eq ${id}`,
      },
      {
        field: "cf_receiving_company",
        method: "searchObject",
        args: [oids.receiving],
        aql: (id) => `SELECT name FROM __main__ where id eq ${id}`,
      },
      {
        field: "cf_bill_to_company",
        method: "searchObject",
        args: [oids.billTo],
        aql: (id) => `SELECT name FROM __main__ where id eq ${id}`,
      },
    ];

    for (const item of objectLookups) {
      if (attrs[item.field]) {
        const query = item.aql(attrs[item.field]);
        const args = item.args ? [...item.args, query] : [query];
        const result = await this.api[item.method](...args);
        if (result && result.attributes.name) {
          attrs[item.field] = result.attributes.name;
        }
      }
    }

    const userFields = [
      "cf_requisitioner",
      "cf_project_manager",
      "cf_received_by",
      "cf_accounting_personnel",
    ];
    for (const field of userFields) {
      const val = attrs[field];
      if (!val) continue;
      if (Array.isArray(val)) {
        const names = [];
        for (const uid of val) {
          const name = await this.api.resolveUserToName(uid);
          if (name) names.push(name);
        }
        attrs[field] = names.join(", ");
      } else {
        const name = await this.api.resolveUserToName(val);
        if (name) attrs[field] = name;
      }
    }
  }

  // --- EMAIL LOGIC ---
  async _handleEmail(recordId, recordData) {
    const attrs = recordData.attributes;

    // 1. Resolve Recipients
    // const recipients = new Set(["BTQAR@biotech.com"]);
    const recipients = new Set(["carliedayle21@gmail.com"]);
    // Hardcode your test email as requested previously
    recipients.add("blagundino@biotech.com");
    recipients.add("clong@biotech.com");

    if (attrs.cf_client_email_address_btpo)
      recipients.add(attrs.cf_client_email_address_btpo.trim());

    const userPickers = ["cf_client_qa_approvers", "cf_bt_users"];
    for (const field of userPickers) {
      const val = attrs[field];
      if (val) {
        const ids = Array.isArray(val) ? val : [val];
        for (const uid of ids) {
          const email = await this.api.getUserEmail(uid);
          if (email) recipients.add(email);
        }
      }
    }

    const recipientList = Array.from(recipients).filter(
      (e) => e && e.includes("@")
    );
    if (recipientList.length === 0) {
      console.log("No valid recipients for email.");
      return;
    }

    // 2. Generate PDF
    console.log("Generating PDF...");
    const generator = new InvoiceGenerator();
    const pdfBuffer = await generator.generate(recordData, "INVOICE");

    // 3. Construct Email Body (Template)
    const clientName = attrs.cf_client || "Client";
    const invoiceNum = `${attrs.pkey || recordId}-INV`;
    const poNum = attrs.cf_po_number || "N/A";

    // Format Amount
    const rawTotal = parseFloat(attrs.cf_total_w_handlingfe || 0);
    const invoiceAmount = `$${rawTotal.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

    // Format Date
    const dueDate = this._formatDate(attrs.cf_due_date_client_invoice);

    const emailBody = `Hello ${clientName} Team,

I hope you are doing well!

Attached is a copy of the Invoice # ${invoiceNum}  billed on your PO # ${poNum}.

Invoice Amount: ${invoiceAmount}
Due Date: ${dueDate}

E-mail remittance details: BTQAR@biotech.com
Preferred method of payment: ACH or wire transfer

Thank you for choosing BioTechnique LLC!
We value you as a customer and appreciate your continued business with us!


Best regards,
BioTechnique Team`;

    console.log(`Sending Email to: ${recipientList.join(", ")}`);

    await this.email.sendInvoice(
      recipientList,
      pdfBuffer,
      `Invoice ${invoiceNum} - ${clientName}`, // Subject line
      emailBody
    );
  }

  _formatDate(dateStr) {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    // Format: 09 Jan 2026
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }
}
