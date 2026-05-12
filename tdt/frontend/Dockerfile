FROM node:20-alpine
WORKDIR /app

# Add these lines to accept build arguments
ARG VITE_AUTH0_DOMAIN
ARG VITE_AUTH0_CLIENT_ID

# Set them as environment variables for the build process
ENV VITE_AUTH0_DOMAIN=$VITE_AUTH0_DOMAIN
ENV VITE_AUTH0_CLIENT_ID=$VITE_AUTH0_CLIENT_ID

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

RUN npm install -g serve
CMD ["sh", "-c", "serve -s dist -l $PORT"]