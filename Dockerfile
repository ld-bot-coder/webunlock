# Use official Playwright image with Node and Browsers
FROM mcr.microsoft.com/playwright:v1.49.1-jammy

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript to JavaScript
RUN npm run build

# Expose API port
EXPOSE 3000

# Start server
CMD ["npm", "start"]
