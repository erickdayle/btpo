FROM node:18-slim

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./
# Install dependencies
RUN npm install

# Copy application files
COPY app.js ./
COPY purchase_order_processor.js ./
COPY entrypoint.sh ./  

# Make entrypoint executable
RUN chmod +x ./entrypoint.sh

# Define entrypoint
ENTRYPOINT ["./entrypoint.sh"]

# Default arguments (overridden by Code Engine)
CMD ["--recordId", "defaultRecordId", "--projectId", "defaultProjectId"]