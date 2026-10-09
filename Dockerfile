# Use Node.js 20 slim as the base image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package definition
COPY package.json ./

# Install all dependencies (vite's optional esbuild peer conflicts with the pinned esbuild)
RUN npm install --legacy-peer-deps

# Copy all application source code
COPY . .

# Build the frontend assets for production
RUN npm run build

# Default exposed port (Railway injects dynamic PORT at runtime)
EXPOSE 3000

# Environment setup
ENV NODE_ENV=production
ENV PORT=3000

# Start the full-stack server
CMD ["npm", "start"]
