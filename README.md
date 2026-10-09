# TeleMax High-Speed Telegram Forwarder

Automatically sync, clip, and repost Telegram group videos while cleaning titles and links for your target channels.

## 🚀 Deployment Guide

### 1. Prerequisites
- [Node.js 20+](https://nodejs.org/)
- Telegram API ID and API Hash (Get them from [my.telegram.org](https://my.telegram.org))

### 2. Local Setup
1. Clone your repository:
   ```bash
   git clone <your-repo-url>
   cd telemax-forwarder
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file:
   ```bash
   cp .env.example .env
   ```
   *Edit `.env` and add your `APP_URL` and optionally your Telegram API credentials.*

4. Build and Start:
   ```bash
   npm run build
   npm start
   ```

### 3. Docker Deployment (Recommended)
This app is ready to be deployed using Docker.

1. Build the image:
   ```bash
   docker build -t telemax-forwarder .
   ```
2. Run the container:
   ```bash
   docker run -d -p 3000:3000 --name telemax telemax-forwarder
   ```

### 4. Cloud Deployment (Railway, Render, VPS)
- **Railway/Render**: Simply connect your GitHub repository. The `Dockerfile` will be automatically detected.
- **Environment Variables**: Make sure to set `NODE_ENV=production` and `PORT=3000` in your cloud dashboard.
- **Persistence**: This app saves session data in the `./data` folder. For "all time" working on cloud platforms, ensure you mount a persistent volume to `/app/data`.

## 🛠 Features
- **0.5s Turbo Relay**: Near-instantaneous video forwarding directly from Telegram CDN.
- **Zero-Flood Shield**: Intelligent round-robin background sweep with rate limit protection.
- **Album / Media Pairing**: Keeps videos and accompanying screenshot photos together.
- **End-to-End Secure**: Protected by master password and single-user active session locking.
