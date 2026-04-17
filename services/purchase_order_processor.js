import InvoiceGenerator from "./invoice_generator.js";

export default class PurchaseOrderProcessor {
  constructor(apiService, emailService, config) {
    this.api = apiService;
    this.email = emailService;
    this.config = config;
  }

  async process(recordId) {
    console.log(`Processing Record: ${recordId}`);

    let recordData = await this.api.getRecordMeta(recordId);
    if (!recordData) throw new Error("Record not found");

    const updates = await this._calculateTotals(
      recordId,
      recordData.attributes,
    );
    if (Object.keys(updates).length > 0) {
      await this.api.updateRecord(recordId, updates);
      recordData = await this.api.getRecordMeta(recordId);
    } else {
      console.log("No subtotal updates required.");
    }

    await this._enrichData(recordData.attributes);

    // Check Workflow Step before sending email
    const statusId = recordData.relationships?.status?.data?.id;

    if (statusId) {
      const stepData = await this.api.getWorkflowStep(statusId);
      const stepName = stepData?.attributes?.text;

      if (
        stepName === "Pending Customer Payment" ||
        stepName === "Resend Client Invoice"
      ) {
        await this._handleEmail(recordId, recordData, stepName);
      } else {
        console.log(
          `Workflow step is "${stepName}". Skipping email (requires "Pending Customer Payment" or "Resend Client Invoice").`,
        );
      }
    } else {
      console.log("No workflow status ID found. Skipping email.");
    }
  }

  async _calculateTotals(recordId, attrs) {
    const updates = {};
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
        },
      );
      if (res.shouldUpdate) updates.cf_subtotal_n = res.subtotal;
    }
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
        },
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

  async _enrichData(attrs) {
    console.log("Resolving Reference Data...");
    const oids = this.config.objects;
    const lookups = [
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

    for (const item of lookups) {
      if (attrs[item.field]) {
        const query = item.aql(attrs[item.field]);
        const args = item.args ? [...item.args, query] : [query];
        const result = await this.api[item.method](...args);
        if (result && result.attributes.name)
          attrs[item.field] = result.attributes.name;
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

  async _handleEmail(recordId, recordData, stepName) {
    const attrs = recordData.attributes;

    const recipients = new Set([
      // "clong@biotech.com",
      // "blagundino@biotech.com",
      // "eloon@biotech.com",
      // "aguzman@biotech.com",
      // "maryg@biotech.com",
      // "gwong@biotech.com",
    ]);

    if (attrs.cf_client_email_address_btpo)
      recipients.add(attrs.cf_client_email_address_btpo.trim());

    const userPickers = ["cf_client_qa_approvers", "cf_bt_users"];
    for (const field of userPickers) {
      const val = attrs[field];
      if (val) {
        const ids = Array.isArray(val) ? val : [val];
        // Fetch all emails at once using the new bulk method
        const emails = await this.api.getUsersEmailsBulk(ids);
        emails.forEach((email) => recipients.add(email));
      }
    }

    const recipientList = Array.from(recipients).filter(
      (e) => e && e.includes("@"),
    );

    // Add BTQAR as CC
    const ccRecipients = ["BTQAR@biotech.com"];

    if (recipientList.length === 0) {
      console.log("No valid recipients for email.");
      return;
    }

    console.log("Generating Consolidated Invoice PDF...");
    const generator = new InvoiceGenerator();
    const attachments = [];
    const pkey = attrs.pkey || recordId;

    const clientInvoiceBuffer = await generator.generate(recordData, "INVOICE");
    if (clientInvoiceBuffer) {
      attachments.push({
        filename: `${pkey}-INV Invoice.pdf`,
        content: clientInvoiceBuffer,
        contentType: "application/pdf",
      });
    }

    const clientName = attrs.cf_client || "Client";
    const poNum = attrs.cf_po_number || "N/A";
    const isInternal = attrs.cf_po_type === "Internal";
    const rawTotal = isInternal
      ? parseFloat(attrs.cf_total_ca || 0)
      : parseFloat(attrs.cf_total_w_handlingfe || 0);

    const invoiceAmount = `$${rawTotal.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
    const dueDate = this._formatDate(attrs.cf_due_date_client_invoice);

    const emailSubject = `Invoice ${pkey}-INV | ${clientName} | Due for payment on ${dueDate}`;

    const isRevised = stepName === "Resend Client Invoice";

    const emailBody = isRevised
      ? `Hello ${clientName} Team,

Do not reply to this email. For any questions or concerns, reach out to BTQAR@biotech.com.

I hope you are doing well!

Attached is the revised version of the consolidated invoice for ${poNum}. Please note that this document supersedes the previous invoice sent.

Please help to do the needful on your end to ensure timely payment using this updated copy.
Invoice Amount: ${invoiceAmount}
Due Date: ${dueDate}

E-mail remittance details: BTQAR@biotech.com

Preferred method of payment: ACH or wire transfer

Thank you for choosing BioTechnique LLC!
We value you as a customer and appreciate your continued business with us!


Best regards,

BioTechnique Team`
      : `Hello ${clientName} Team,

Do not reply to this email. For any questions or concerns, reach out to BTQAR@biotech.com.

I hope you are doing well!

Attached is the consolidated invoice document for PO # ${poNum}.

Please help to do the needful on your end to ensure timely payment.
Invoice Amount: ${invoiceAmount}
Due Date: ${dueDate}

E-mail remittance details: BTQAR@biotech.com

Preferred method of payment: ACH or wire transfer

Thank you for choosing BioTechnique LLC!
We value you as a customer and appreciate your continued business with us!


Best regards,
BioTechnique Team`;

    console.log(
      `Sending Email to: ${recipientList.join(", ")} | CC: ${ccRecipients.join(", ")}`,
    );

    await this.email.sendInvoice(
      recipientList,
      ccRecipients,
      attachments,
      emailSubject,
      emailBody,
    );
  }

  _formatDate(dateStr) {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }
}
