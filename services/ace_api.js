import fetch from "node-fetch";

export default class AceApiService {
  constructor(config) {
    this.baseUrl = config.ace.baseUrl;
    this.headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.ace.token}`,
    };
  }

  // --- GENERIC METHODS ---

  async getRecordMeta(recordId) {
    const res = await fetch(`${this.baseUrl}/records/${recordId}/meta`, {
      headers: this.headers,
    });
    if (!res.ok)
      throw new Error(`Failed to fetch record ${recordId}: ${res.statusText}`);
    const json = await res.json();
    return json.data;
  }

  async updateRecord(recordId, attributes) {
    const body = JSON.stringify({ data: { type: "records", attributes } });
    const res = await fetch(`${this.baseUrl}/records/${recordId}`, {
      method: "PATCH",
      headers: this.headers,
      body,
    });
    if (!res.ok)
      throw new Error(
        `Failed to update record ${recordId}: ${await res.text()}`
      );
  }

  async updateTable(recordId, tableFieldId, rowsData) {
    const payloadData = rowsData.map((row) => ({
      type: "record-table-row",
      attributes: { name: row.name, ...row.values },
    }));
    const res = await fetch(
      `${this.baseUrl}/records/${recordId}/table/${tableFieldId}`,
      {
        method: "PATCH",
        headers: this.headers,
        body: JSON.stringify({ data: payloadData }),
      }
    );
    if (!res.ok)
      throw new Error(
        `Failed to update table ${tableFieldId}: ${await res.text()}`
      );
  }

  // --- SEARCH HELPERS ---

  async searchGroup(aql) {
    return this._postSearch("/groups/search", aql);
  }

  async searchObject(objectId, aql) {
    return this._postSearch(`/objects/${objectId}/search`, aql);
  }

  // --- USER & PERSON LOGIC (The Fix) ---

  /**
   * Resolves a User ID to a human readable name by chaining User -> Person queries.
   * @param {string} userId
   * @returns {Promise<string|null>} "First Last" or null
   */
  async resolveUserToName(userId) {
    if (!userId) return null;

    try {
      // 1. Get User to find person_id
      const userRes = await fetch(`${this.baseUrl}/users/${userId}`, {
        headers: this.headers,
      });
      if (!userRes.ok) return null;

      const userJson = await userRes.json();
      const personId = userJson.data?.attributes?.person_id;

      if (!personId) {
        // Fallback: if no person linked, try to use username
        return userJson.data?.attributes?.username || null;
      }

      // 2. Get Person to find names
      const personRes = await fetch(`${this.baseUrl}/people/${personId}`, {
        headers: this.headers,
      });
      if (!personRes.ok) return null;

      const personJson = await personRes.json();
      const attrs = personJson.data?.attributes;

      if (attrs) {
        return `${attrs.first_name || ""} ${attrs.last_name || ""}`.trim();
      }
      return null;
    } catch (e) {
      console.error(`Failed to resolve user ${userId}:`, e.message);
      return null;
    }
  }

  /**
   * Fetches the email for a user (via Person record if needed).
   */
  async getUserEmail(userId) {
    if (!userId) return null;
    try {
      const userRes = await fetch(`${this.baseUrl}/users/${userId}`, {
        headers: this.headers,
      });
      if (!userRes.ok) return null;
      const userJson = await userRes.json();

      // Sometimes email is on User, sometimes on Person. Check Person first for accuracy.
      const personId = userJson.data?.attributes?.person_id;
      if (personId) {
        const personRes = await fetch(`${this.baseUrl}/people/${personId}`, {
          headers: this.headers,
        });
        if (personRes.ok) {
          const personJson = await personRes.json();
          if (personJson.data?.attributes?.email) {
            return personJson.data.attributes.email;
          }
        }
      }
      // Fallback to User email if Person failed or didn't have one
      return userJson.data?.attributes?.email || null;
    } catch (e) {
      return null;
    }
  }

  async _postSearch(endpoint, aql) {
    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ aql }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data && json.data.length > 0 ? json.data[0] : null;
  }
}
