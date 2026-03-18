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
        `Failed to update record ${recordId}: ${await res.text()}`,
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
      },
    );
    if (!res.ok)
      throw new Error(
        `Failed to update table ${tableFieldId}: ${await res.text()}`,
      );
  }

  // --- SEARCH HELPERS ---

  async searchGroup(aql) {
    return this._postSearch("/groups/search", aql);
  }

  async searchObject(objectId, aql) {
    return this._postSearch(`/objects/${objectId}/search`, aql);
  }

  // --- USER & PERSON LOGIC ---

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
   * Fetches the email for a user, handling the User -> Person relationship
   */
  async getUserEmail(userId) {
    if (!userId) return null;

    try {
      // Step 1: Assume the ID is a User ID. Fetch the User to get the person_id.
      const userRes = await fetch(`${this.baseUrl}/users/${userId}`, {
        headers: this.headers,
      });

      if (userRes.ok) {
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
      }

      // Step 2: Fallback. If the above didn't return an email (maybe the ID was ALREADY a person ID).
      const directPersonRes = await fetch(`${this.baseUrl}/people/${userId}`, {
        headers: this.headers,
      });

      if (directPersonRes.ok) {
        const directPersonJson = await directPersonRes.json();
        return directPersonJson.data?.attributes?.email || null;
      }

      return null;
    } catch (e) {
      console.error(`Failed to fetch email for ID ${userId}:`, e.message);
      return null;
    }
  }

  /**
   * Fetches emails for an array of User IDs in a single query
   * using the /users/search endpoint with a JOIN.
   */
  async getUsersEmailsBulk(userIds) {
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) return [];

    const idsString = userIds.join(", ");
    const aql = `select id, person_id, username, person.email from __main__ JOIN person where id in (${idsString})`;

    try {
      const res = await fetch(`${this.baseUrl}/users/search`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({ aql }),
      });

      if (!res.ok) return [];

      const json = await res.json();
      if (!json.data) return [];

      // Map through the response to extract just the emails
      return json.data
        .map((record) => record.attributes?.email)
        .filter((email) => email); // Filter out nulls/undefined
    } catch (e) {
      console.error(
        `Failed to fetch bulk emails for users [${idsString}]:`,
        e.message,
      );
      return [];
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
