# Use Node base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files and install
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build the app (if using React/Vue/Next)
RUN npm run build

# Expose port
EXPOSE 3000

# Run the dev server or serve build (adjust based on your framework)
CMD ["npm", "start"]