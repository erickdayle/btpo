FROM node:18-slim

WORKDIR /app

# 1. Install dependencies first (for better caching)
COPY package*.json ./
RUN npm install

# 2. Copy the new folder structure
# We copy the specific folders we created during refactoring
COPY config ./config
COPY services ./services

# 3. Copy root files
COPY app.js ./
COPY entrypoint.sh ./  

# 4. Permissions and Entrypoint
RUN chmod +x ./entrypoint.sh

ENTRYPOINT ["./entrypoint.sh"]

# Default arguments
CMD ["--recordId", "defaultRecordId", "--projectId", "defaultProjectId"]