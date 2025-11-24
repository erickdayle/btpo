export default class PurchaseOrderProcessor {
  constructor(baseUrl, token, tableIdInternal, tableIdExternal) {
    if (!baseUrl || !token) {
      throw new Error("Missing API configuration (Base URL or Token).");
    }
    this.url = baseUrl;
    this.tableIdInternal = tableIdInternal;
    this.tableIdExternal = tableIdExternal;
    this.headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  /**
   * Main Orchestrator
   */
  async processRecordUpdate(recordId) {
    // 1. Fetch current data
    const recordData = await this._getRecordData(recordId);
    if (!recordData || !recordData.attributes) {
      throw new Error(`No data found for record ${recordId}`);
    }

    const attrs = recordData.attributes;
    const subtotalUpdates = {}; // Only for main record fields (Subtotals)

    // 2. Process INTERNAL Table
    if (attrs.cf_items_btpo) {
      const internalMapping = {
        qty: "cf_order_qty_int",
        price: "cf_price_per_unit_int",
        amount: "cf_dollar_amount_internal",
        desc: "cf_item_desc_int",
        uom: "cf_uom_int",
        part: "cf_item_part_num_int",
      };

      // --- FIX: Added 'await' here ---
      const result = await this._calculateAndSyncTable(
        recordId,
        this.tableIdInternal,
        attrs.cf_items_btpo,
        internalMapping
      );

      if (result.shouldUpdateSubtotal) {
        subtotalUpdates.cf_subtotal_n = result.subtotal;
      }
    }

    // 3. Process EXTERNAL Table
    if (attrs.cf_items_btpo_api2) {
      const externalMapping = {
        qty: "cf_order_qty_ext",
        price: "cf_price_per_unit_ext",
        amount: "cf_dollar_amount_external",
        desc: "cf_item_desc_ext",
        uom: "cf_uom_ext",
        part: "cf_item_part_num_ext",
      };

      // --- FIX: Added 'await' here ---
      const result = await this._calculateAndSyncTable(
        recordId,
        this.tableIdExternal,
        attrs.cf_items_btpo_api2,
        externalMapping
      );

      if (result.shouldUpdateSubtotal) {
        subtotalUpdates.cf_subtotal_external = result.subtotal;
      }
    }

    // 4. Update Subtotals on Main Record (if needed)
    console.log("Subtotal updates collected:", JSON.stringify(subtotalUpdates));

    if (Object.keys(subtotalUpdates).length > 0) {
      await this._updateRecord(recordId, subtotalUpdates);
    } else {
      console.log("No subtotal updates required.");
    }
  }

  /**
   * Calculates totals and calls the Table API to update specific rows
   * @param {string} recordId
   * @param {string} tableFieldId
   * @param {string} tableString
   * @param {Object} map - Contains keys for qty, price, amount, desc, uom, part
   */
  async _calculateAndSyncTable(recordId, tableFieldId, tableString, map) {
    let rows = [];
    try {
      rows = JSON.parse(tableString);
    } catch (e) {
      console.error(`Error parsing table string for field ${tableFieldId}`, e);
      return { shouldUpdateSubtotal: false };
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return { shouldUpdateSubtotal: false };
    }

    let subtotal = 0;
    const rowsToUpdate = [];

    rows.forEach((row) => {
      if (row.values) {
        const qty = parseFloat(row.values[map.qty]) || 0;
        const price = parseFloat(row.values[map.price]) || 0;
        const currentAmount = parseFloat(row.values[map.amount]) || 0;

        // Calculate new amount
        const rawAmount = qty * price;
        const formattedAmount = rawAmount.toFixed(2);

        // Add to running subtotal
        subtotal += rawAmount;

        // Check if we need to update this row
        if (formattedAmount !== currentAmount.toFixed(2)) {
          // --- FIX: EXPLICIT & CONDITIONAL MAPPING ---
          // 1. Always include mandatory fields (Desc, UOM, Qty, Price, Amount)
          const updatedValues = {
            [map.amount]: formattedAmount,
            [map.qty]: row.values[map.qty],
            [map.price]: row.values[map.price],
            [map.desc]: row.values[map.desc],
            [map.uom]: row.values[map.uom],
          };

          // 2. Conditionally include optional fields that break validation if empty (Part Num)
          const partNum = row.values[map.part];
          if (partNum !== undefined && partNum !== null && partNum !== "") {
            updatedValues[map.part] = partNum;
          }

          rowsToUpdate.push({
            name: row.name, // The Row ID
            values: updatedValues,
          });
        }
      }
    });

    // If there are rows that have changed, send them to the Table API
    if (rowsToUpdate.length > 0) {
      console.log(
        `Table ${tableFieldId}: Found ${rowsToUpdate.length} rows needing update.`
      );
      await this._updateTableEndpoint(recordId, tableFieldId, rowsToUpdate);
      return { shouldUpdateSubtotal: true, subtotal: subtotal.toFixed(2) };
    }

    // Return true to enforce subtotal consistency
    return { shouldUpdateSubtotal: true, subtotal: subtotal.toFixed(2) };
  }

  // --- API Methods ---

  async _updateTableEndpoint(recordId, tableFieldId, rowsData) {
    console.log(`\nSyncing Table ${tableFieldId} for Record ${recordId}...`);

    // Transform to the specific format
    const payloadData = rowsData.map((row) => ({
      type: "record-table-row",
      attributes: {
        name: row.name,
        ...row.values, // Spreads the sanitized values constructed above
      },
    }));

    const updateBody = { data: payloadData };

    console.log(
      `Payload for Table ${tableFieldId}:`,
      JSON.stringify(updateBody)
    );

    const response = await fetch(
      `${this.url}/records/${recordId}/table/${tableFieldId}`,
      {
        method: "PATCH",
        headers: this.headers,
        body: JSON.stringify(updateBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Table update for ${tableFieldId} failed:`, errorText);
      throw new Error(`Table update failed: ${errorText}`);
    }

    console.log(`Table ${tableFieldId} updated successfully.`);
  }

  async _getRecordData(recordId) {
    console.log(`Fetching full data for record: ${recordId}`);
    const response = await fetch(`${this.url}/records/${recordId}/meta`, {
      headers: this.headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to fetch record data:`, errorText);
      return null;
    }

    const responseBodyText = await response.text();
    try {
      const result = JSON.parse(responseBodyText);
      return result.data;
    } catch (e) {
      console.error("Failed to parse JSON:", e);
      return null;
    }
  }

  async _updateRecord(recordId, attributesToUpdate) {
    console.log(`\nUpdating Main Record Subtotals: ${recordId}`);

    const updateBody = {
      data: {
        type: "records",
        attributes: attributesToUpdate,
      },
    };

    const response = await fetch(`${this.url}/records/${recordId}`, {
      method: "PATCH",
      headers: this.headers,
      body: JSON.stringify(updateBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Record update failed:`, errorText);
      throw new Error(`Record update failed: ${errorText}`);
    }

    console.log(`Main Record updated successfully.`);
  }
}
