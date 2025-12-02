import "dotenv/config";

const config = {
  ace: {
    baseUrl: process.env.ACE_API_BASE_URL,
    token: process.env.ACE_API_TOKEN,
  },
  tables: {
    internalId: process.env.TABLE_FIELD_ID_INTERNAL,
    externalId: process.env.TABLE_FIELD_ID_EXTERNAL,
  },
  objects: {
    department: process.env.OBJECT_ID_DEPARTMENT || "37",
    project: process.env.OBJECT_ID_PROJECT || "54",
    supplier: process.env.OBJECT_ID_SUPPLIER || "50",
    receiving: process.env.OBJECT_ID_RECEIVING || "51",
    billTo: process.env.OBJECT_ID_BILL_TO || "52",
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
};

// Simple validation
if (!config.ace.baseUrl || !config.ace.token) {
  throw new Error("Missing ACE API Configuration in .env");
}

export default config;
