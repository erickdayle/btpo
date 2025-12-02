import PDFDocument from "pdfkit-table";

export default class InvoiceGenerator {
  constructor() {
    this.logoUrl = "logo.png";
    this.margins = {
      top: 36, // 0.5 in
      bottom: 36, // 0.5 in
      left: 54, // 0.75 in
      right: 54, // 0.75 in
    };
    this.width = 504;
    this.startX = 54;

    this.fontNormal = "Times-Roman";
    this.fontBold = "Times-Bold";
    this.fontSizeNormal = 11;
    this.fontSizeHeader = 12;
    this.fontSizeSmall = 9;
  }

  async generate(recordData, templateType = "INVOICE") {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          margin: this.margins.top,
          size: "LETTER",
          margins: this.margins,
          bufferPages: false,
        });
        const buffers = [];

        doc.on("data", (chunk) => buffers.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(buffers)));
        doc.on("error", (err) => reject(err));

        doc.x = this.startX;
        doc.y = this.margins.top;

        if (templateType === "INVOICE") {
          await this._generateClientInvoice(doc, recordData);
        } else {
          await this._generateVendorPO(doc, recordData);
        }

        doc.end();
      } catch (e) {
        reject(e);
      }
    });
  }

  // ===========================================================================
  //                          CLIENT INVOICE TEMPLATE
  // ===========================================================================

  async _generateClientInvoice(doc, data) {
    const attrs = data.attributes;

    try {
      doc.image(this.logoUrl, this.startX, this.margins.top, { width: 140 });
    } catch (e) {
      doc
        .fontSize(20)
        .font(this.fontBold)
        .text("BioTechnique", this.startX, this.margins.top);
    }

    const rightBoxX = 320;
    let y = this.margins.top + 5;
    doc.fontSize(this.fontSizeNormal);

    const invoiceNo = `${attrs.pkey || data.id}-INV`;
    this._drawField(doc, "Invoice Number:", invoiceNo, rightBoxX, y, true);
    y += 15;
    this._drawField(
      doc,
      "Invoice Date:",
      this._formatDate(attrs.cf_date_client_invoice),
      rightBoxX,
      y
    );
    y += 15;
    this._drawField(
      doc,
      "Invoice Due Date:",
      this._formatDate(attrs.cf_due_date_client_invoice),
      rightBoxX,
      y
    );
    y += 15;
    this._drawField(
      doc,
      "Customer PO Number:",
      attrs.cf_po_number,
      rightBoxX,
      y
    );
    y += 15;
    this._drawField(
      doc,
      "Payment Terms:",
      attrs.cf_invoice_payment_term,
      rightBoxX,
      y
    );

    y = 145;
    const leftPad = this.startX + 5;
    doc.font(this.fontBold).text("INVOICE TO:", leftPad, y + 10);
    doc.font(this.fontNormal);

    const contentX = leftPad + 90;
    doc.text(this._getLabel(attrs.cf_client) || "", contentX, y + 10);
    doc.text(attrs.cf_client_address_crm || "", contentX, y + 22);
    doc.text(
      `${attrs.cf_address_city || ""} ${attrs.cf_address_state || ""} ${
        attrs.cf_address_zip || ""
      }`,
      contentX,
      y + 34
    );
    doc.text(attrs.cf_address_country || "", contentX, y + 46);

    const midX = this.startX + this.width / 2;
    const rightPad = midX + 10;
    doc.font(this.fontBold).text("SHIP TO:", rightPad, y + 10);
    doc.font(this.fontNormal);

    const rightContentX = rightPad + 70;
    doc.text(
      this._getLabel(attrs.cf_receiving_company) || "",
      rightContentX,
      y + 10
    );
    doc.text(attrs.cf_shipping_address || "", rightContentX, y + 22);
    doc.text(
      `${attrs.cf_ship_to_city || ""} ${attrs.cf_ship_to_state || ""} ${
        attrs.cf_ship_to_zip || ""
      }`,
      rightContentX,
      y + 34
    );
    doc.text(attrs.cf_ship_to_country || "", rightContentX, y + 46);

    y += 85;
    doc.font(this.fontBold).text("Project:", this.startX, y);
    doc
      .font(this.fontNormal)
      .text(this._getLabel(attrs.cf_project_psc) || "N/A", this.startX + 50, y);

    await this._addTable(doc, data, false, this.width);

    doc.moveDown(1);

    // --- LAYOUT ADJUSTMENT FOR TOTALS ---
    // Increased labelW from 120 to 200 to allow "Invoice Total (USD):" to fit on one line
    const labelW = 200;
    const valueW = 80;
    const valueX = this.startX + this.width - valueW;
    const labelX = valueX - labelW;

    const map = {
      sub: "cf_subtotal_external",
      tax: "cf_tax_external",
      ship: "cf_shipping_n_handling_external",
      other: "cf_others_external",
      disc: "cf_discount_ext",
      hand: "cf_additional_handling_ext",
      total: "cf_total_w_handlingfe",
    };

    this._drawTotalLine(doc, "Order Total:", attrs[map.sub], labelX, valueX);
    this._drawTotalLine(doc, "Sales Tax:", attrs[map.tax], labelX, valueX);
    this._drawTotalLine(
      doc,
      "Shipping & Handling:",
      attrs[map.ship],
      labelX,
      valueX
    );
    this._drawTotalLine(doc, "Other:", attrs[map.other], labelX, valueX);
    this._drawTotalLine(
      doc,
      "Discount:",
      attrs[map.disc],
      labelX,
      valueX,
      true
    );
    this._drawTotalLine(doc, "Handling Fee:", attrs[map.hand], labelX, valueX);

    doc.moveDown(0.5);
    this._drawTotalLine(
      doc,
      "Invoice Total (USD):",
      attrs[map.total],
      labelX,
      valueX,
      false,
      true,
      14
    );

    this._addInvoiceFooter(doc);
  }

  _addInvoiceFooter(doc) {
    doc.moveDown(1.5);
    doc.font(this.fontNormal).fontSize(this.fontSizeSmall);

    doc.text("Thank you for choosing BioTechnique LLC!", this.startX, doc.y, {
      width: this.width,
      align: "center",
    });
    doc.text(
      "We value you as a customer and appreciate your business with us!",
      this.startX,
      doc.y,
      { width: this.width, align: "center" }
    );

    doc.moveDown(0.5);
    doc
      .fillColor("red")
      .text(
        "Preferred method of payment: ACH or wire transfer",
        this.startX,
        doc.y,
        { width: this.width, align: "center" }
      );
    doc.fillColor("black");

    doc.moveDown(0.5);
    doc
      .font(this.fontBold)
      .fontSize(this.fontSizeSmall)
      .fillColor("red")
      .text(
        "BANK INFORMATION FOR ACH OR WIRE TRANSFER PAYMENTS",
        this.startX,
        doc.y,
        { width: this.width, align: "center" }
      );
    doc.fillColor("black");

    doc.moveDown(0.3);
    const centerLine = this.startX + this.width / 2;
    const labelColX = centerLine - 10;
    const valColX = centerLine + 10;

    const bankDetails = [
      ["Beneficiary Name:", "BIOTECHNIQUE LLC"],
      ["Receiving Bank Name:", "East West Bank"],
      ["Beneficiary Account:", "80 64012910"],
      [
        "Bank Routing Number: (Domestic wires)",
        "3 | 2 | 2 | 0 | 7 | 0 | 3 | 8 | 1",
      ],
      ["Bank Routing/Swift Code: (International wires)", "EWBKUS66XXX"],
      ["Remittance Details E-mail:", "BTQAR@biotech.com"],
    ];

    bankDetails.forEach(([label, val]) => {
      if (doc.y > 700) doc.addPage();
      doc.font(this.fontNormal);
      doc.text(label, this.startX, doc.y, {
        width: this.width / 2 - 20,
        align: "right",
      });
      doc.moveUp();
      doc.font(this.fontBold);
      doc.text(val, valColX, doc.y, {
        width: this.width / 2 - 20,
        align: "left",
      });
      doc.moveDown(0.1);
    });

    doc.moveDown(0.5);

    doc
      .font(this.fontBold)
      .fillColor("blue")
      .text("HQ REMITTANCE ADDRESS FOR CHECK PAYMENTS", this.startX, doc.y, {
        width: this.width / 2 - 20,
        align: "right",
      });
    doc.fillColor("black");
    doc.moveUp();

    let currentY = doc.y;
    const lineHeight = 10;

    doc.font(this.fontBold);
    doc.text("BIOTECHNIQUE LLC", valColX, currentY, {
      width: this.width / 2 - 20,
      align: "left",
    });

    currentY += lineHeight;
    doc.font(this.fontNormal);
    doc.text("700 Corporate Center", valColX, currentY, {
      width: this.width / 2 - 20,
      align: "left",
    });

    currentY += lineHeight;
    doc.text("Drive, Suite 201", valColX, currentY, {
      width: this.width / 2 - 20,
      align: "left",
    });

    currentY += lineHeight;
    doc.text("Pomona, CA 91768", valColX, currentY, {
      width: this.width / 2 - 20,
      align: "left",
    });

    doc.y = currentY + 25;
  }

  // ===========================================================================
  //                          VENDOR PO TEMPLATE
  // ===========================================================================

  async _generateVendorPO(doc, data) {
    const isInternal = data.attributes.cf_po_type === "Internal";
    const attrs = data.attributes;

    try {
      doc.image(this.logoUrl, this.startX, this.margins.top, { width: 140 });
    } catch (e) {
      doc
        .fontSize(20)
        .font(this.fontBold)
        .text("BioTechnique", this.startX, this.margins.top);
    }

    const rightBoxX = 320;
    let y = this.margins.top + 5;
    doc.fontSize(this.fontSizeNormal);

    this._drawField(
      doc,
      "Purchase Order No:",
      attrs.pkey || data.id,
      rightBoxX,
      y,
      true
    );
    y += 15;
    this._drawField(
      doc,
      "Quote No:",
      attrs.cf_quote_number || "N/A",
      rightBoxX,
      y
    );
    y += 15;
    this._drawField(
      doc,
      "Payment Terms:",
      attrs.cf_payment_terms || "N/A",
      rightBoxX,
      y
    );

    y = 145;
    doc.fontSize(this.fontSizeNormal);
    doc.font(this.fontBold).text("SUPPLIER:", this.startX + 10, y + 10);
    doc
      .font(this.fontNormal)
      .text(
        this._getLabel(attrs.cf_supplier_company_nam) || "",
        this.startX + 80,
        y + 10
      );

    let addrY = y + 25;
    doc.text(attrs.cf_address_of_supplier || "", this.startX + 80, addrY);
    doc.text(
      `${attrs.cf_supplier_city || ""} ${attrs.cf_supplier_state || ""} ${
        attrs.cf_supplier_zip || ""
      }`,
      this.startX + 80,
      addrY + 12
    );
    doc.text(attrs.cf_supplier_country || "", this.startX + 80, addrY + 24);

    y += 90;
    const midX = this.startX + this.width / 2;

    doc.font(this.fontBold).text("SHIP TO:", this.startX + 10, y + 10);
    doc.font(this.fontNormal);
    doc.text(
      this._getLabel(attrs.cf_receiving_company) || "BioTechnique",
      this.startX + 70,
      y + 10
    );
    doc.text(attrs.cf_shipping_address || "", this.startX + 70, y + 25);
    doc.text(
      `${attrs.cf_ship_to_city || ""} ${attrs.cf_ship_to_state || ""} ${
        attrs.cf_ship_to_zip || ""
      }`,
      this.startX + 70,
      y + 40
    );
    doc.text(attrs.cf_ship_to_country || "", this.startX + 70, y + 55);

    doc.font(this.fontBold).text("BILL TO:", midX + 10, y + 10);
    doc.font(this.fontNormal);
    doc.text(
      this._getLabel(attrs.cf_bill_to_company) || "BioTechnique LLC",
      midX + 70,
      y + 10
    );
    doc.text(attrs.cf_billing_address || "", midX + 70, y + 25);
    doc.text(
      `${attrs.cf_bill_to_city || ""} ${attrs.cf_bill_to_state || ""} ${
        attrs.cf_bill_to_zip || ""
      }`,
      midX + 70,
      y + 40
    );
    doc.text(attrs.cf_bill_to_country || "", midX + 70, y + 55);

    doc.y = y + 80;
    await this._addTable(doc, data, isInternal, this.width);

    this._addTotalsPO(doc, data, isInternal);
    this._addFooterPO(doc);
  }

  _addTotalsPO(doc, data, isInternal) {
    const attrs = data.attributes;
    doc.moveDown(1);

    const labelW = 120;
    const valueW = 80;
    const valueX = this.startX + this.width - valueW;
    const labelX = valueX - labelW;

    const map = isInternal
      ? {
          sub: "cf_subtotal_n",
          tax: "cf_tax_c",
          ship: "cf_shipping_n_handling_c",
          other: "cf_others_c",
          disc: "cf_discount_int",
          total: "cf_total_ca",
        }
      : {
          sub: "cf_subtotal_external",
          tax: "cf_tax_external",
          ship: "cf_shipping_n_handling_external",
          other: "cf_others_external",
          disc: "cf_discount_ext",
          total: "cf_total_btpo",
        };

    if (doc.y > 650) doc.addPage();

    this._drawTotalLine(doc, "Sub-Total:", attrs[map.sub], labelX, valueX);
    this._drawTotalLine(doc, "Sales Tax:", attrs[map.tax], labelX, valueX);
    this._drawTotalLine(
      doc,
      "Shipping & Handling:",
      attrs[map.ship],
      labelX,
      valueX
    );
    this._drawTotalLine(doc, "Other:", attrs[map.other], labelX, valueX);
    this._drawTotalLine(
      doc,
      "Discount:",
      attrs[map.disc],
      labelX,
      valueX,
      true
    );

    doc.moveDown(0.5);
    this._drawTotalLine(
      doc,
      "Total (USD):",
      attrs[map.total],
      labelX,
      valueX,
      false,
      true,
      14
    );
  }

  _addFooterPO(doc) {
    doc.moveDown(4);
    if (doc.y > 700) doc.addPage();
    doc
      .moveTo(this.startX, doc.y)
      .lineTo(this.startX + this.width, doc.y)
      .stroke();
    doc.moveDown(1);
    doc
      .font(this.fontNormal)
      .fontSize(10)
      .text(
        "Please state the purchase order number on the invoice, delivery note, and all other correspondence.\n\n" +
          "Only one purchase order number shall be used on each invoice.\n" +
          "Soft copy invoice is preferred. Please send to BTQAP@biotech.com.",
        this.startX,
        doc.y,
        { width: this.width, align: "center" }
      );
  }

  async _addTable(doc, data, isInternal, width) {
    const attrs = data.attributes;
    doc.moveDown(1);
    let tableRawString = isInternal
      ? attrs.cf_items_btpo
      : attrs.cf_items_btpo_api2;
    let keys = isInternal
      ? {
          desc: "cf_item_desc_int",
          part: "cf_item_part_num_int",
          qty: "cf_order_qty_int",
          uom: "cf_uom_int",
          price: "cf_price_per_unit_int",
          amt: "cf_dollar_amount_internal",
        }
      : {
          desc: "cf_item_desc_ext",
          part: "cf_item_part_num_ext",
          qty: "cf_order_qty_ext",
          uom: "cf_uom_ext",
          price: "cf_price_per_unit_ext",
          amt: "cf_dollar_amount_external",
        };

    let rows = [];
    try {
      rows = JSON.parse(tableRawString || "[]");
    } catch (e) {}

    const table = {
      title: "Purchase Order Items",
      headers: [
        "Item Description",
        "Part Number",
        "Qty",
        "UOM",
        "Price",
        "Amount",
      ],
      rows: rows.map((r) => {
        const v = r.values || {};
        return [
          v[keys.desc] || "",
          v[keys.part] || "",
          v[keys.qty] || "0",
          v[keys.uom] || "",
          `$${v[keys.price] || "0.00"}`,
          `$${v[keys.amt] || "0.00"}`,
        ];
      }),
    };

    const w = width;
    const colWidths = [
      w * 0.4,
      w * 0.15,
      w * 0.1,
      w * 0.1,
      w * 0.125,
      w * 0.125,
    ];

    await doc.table(table, {
      prepareHeader: () => doc.font(this.fontBold).fontSize(10),
      prepareRow: () => doc.font(this.fontNormal).fontSize(10),
      width: width,
      x: this.startX,
      columnsSize: colWidths,
    });
  }

  _drawField(doc, label, value, x, y, boldValue = false) {
    doc.font(this.fontBold).text(label, x, y, { width: 130, align: "right" });
    doc.moveUp();
    if (boldValue) doc.font(this.fontBold);
    else doc.font(this.fontNormal);
    doc.text(value || "N/A", x + 135, y, { width: 150, align: "left" });
  }

  _drawTotalLine(
    doc,
    label,
    value,
    xLabel,
    xValue,
    isDiscount = false,
    isBold = false,
    size = 11
  ) {
    const font = isBold ? this.fontBold : this.fontNormal;
    const width = xValue - xLabel; // Dynamic width based on calculated positions

    doc
      .font(font)
      .fontSize(size)
      .text(label, xLabel, doc.y, { width: width, align: "right" });
    doc.moveUp();
    const valStr = value ? `$${parseFloat(value).toFixed(2)}` : "$0.00";
    doc.text(isDiscount && value > 0 ? `-${valStr}` : valStr, xValue, doc.y, {
      width: 80,
      align: "right",
    });
  }

  _getLabel(field) {
    return String(field);
  }

  _formatDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }
}
