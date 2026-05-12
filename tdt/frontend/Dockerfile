FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Install a simple static file server
RUN npm install -g serve

# Serve the 'dist' folder on the port provided by Cloud Run
CMD ["sh", "-c", "serve -s dist -l $PORT"]