# Change from 18-alpine to 20-alpine or 22-alpine
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files and install
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Expose port
EXPOSE 3000

# Run the app
CMD ["sh", "-c", "npm run dev -- --port $PORT --host 0.0.0.0"]