import { ChannelRoute, TelegramCredentials } from '../types/telegram';

export function generatePythonTelethonBot(
  creds: TelegramCredentials,
  routes: ChannelRoute[]
): string {
  const activeRoutes = routes.filter((r) => r.enabled);
  const sourceChats = activeRoutes.map((r) => `'${r.sourceChat}'`).join(', ');
  const defaultCutSeconds = activeRoutes[0]?.cutDurationSeconds || 5.0;

  return `#!/usr/bin/env python3
"""
TeleTrim - Automated Telegram Video Harvester, 5-Second Trimmer & Relayer
Powered by Telethon & FFmpeg

Instructions:
1. Install requirements: pip install telethon
2. Ensure FFmpeg is installed: sudo apt update && sudo apt install -y ffmpeg
3. Run: python bot.py
"""

import os
import re
import sys
import asyncio
import subprocess
from telethon import TelegramClient, events
from telethon.tl.types import DocumentAttributeVideo, DocumentAttributeFilename

# ==================== CONFIGURATION ====================
API_ID = ${creds.apiId || 'YOUR_API_ID'}  # from my.telegram.org
API_HASH = '${creds.apiHash || 'YOUR_API_HASH'}'  # from my.telegram.org
BOT_TOKEN = '${creds.botToken || ''}'  # Optional: For Bot forwarding mode
PHONE_NUMBER = '${creds.phoneNumber || ''}'

# Channel Mapping: [Source Chat/Channel] -> [Destination Chat/Channel]
ROUTE_MAPPINGS = {
${activeRoutes
  .map(
    (r) =>
      `    '${r.sourceChat}': {
        'dest': '${r.destinationChat}',
        'cut_seconds': ${r.cutDurationSeconds || 5.0},
        'watermark': '${(r.customWatermark || '').replace(/'/g, "\\'")}',
        'remove_links': ${r.removeLinks ? 'True' : 'False'},
    },`
  )
  .join('\n')}
}

SOURCE_CHATS = list(ROUTE_MAPPINGS.keys())
DOWNLOAD_DIR = './temp_downloads'
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

# ==================== REGEX LINK SCRUBBER ====================
TELEGRAM_LINK_REGEX = re.compile(r'https?:\\/\\/(?:t(?:elegram)?\\.me|telegram\\.dog)\\/(?:joinchat\\/|\\+)?([a-zA-Z0-9_\\-]+)(?:\\/[0-9]+)?', re.IGNORECASE)
GENERAL_URL_REGEX = re.compile(r'https?:\\/\\/(?:www\\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b(?:[-a-zA-Z0-9()@:%_+.~#?&//=]*)', re.IGNORECASE)
WWW_URL_REGEX = re.compile(r'\\bwww\\.[-a-zA-Z0-9@:%._+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b(?:[-a-zA-Z0-9()@:%_+.~#?&//=]*)', re.IGNORECASE)
USERNAME_REGEX = re.compile(r'@([a-zA-Z0-9_]{4,32})\\b', re.IGNORECASE)

PROMO_PHRASES = [
    re.compile(r'join\\s+(?:our\\s+)?(?:channel|group|backup|chat)(?:\\s+for\\s+more)?', re.IGNORECASE),
    re.compile(r'subscribe\\s+(?:to\\s+)?(?:our\\s+)?(?:channel|group)', re.IGNORECASE),
    re.compile(r'click\\s+here\\s+(?:to\\s+join|for\\s+link|for\\s+more)', re.IGNORECASE),
    re.compile(r'backup\\s+channel\\s*:\\s*', re.IGNORECASE),
    re.compile(r'download\\s+link\\s*:\\s*', re.IGNORECASE),
]

def sanitize_caption(raw_caption, watermark=''):
    """
    Strips links from title/caption if present.
    If no links are present, keeps caption intact.
    """
    if not raw_caption:
        return watermark.strip() if watermark else ''

    # Check if caption contains links or mentions
    has_links = bool(
        TELEGRAM_LINK_REGEX.search(raw_caption) or
        GENERAL_URL_REGEX.search(raw_caption) or
        WWW_URL_REGEX.search(raw_caption) or
        USERNAME_REGEX.search(raw_caption)
    )

    if not has_links:
        # User rule: If no links, share as is!
        cleaned = raw_caption.strip()
    else:
        # Strip all links and mentions
        cleaned = TELEGRAM_LINK_REGEX.sub('', raw_caption)
        cleaned = GENERAL_URL_REGEX.sub('', cleaned)
        cleaned = WWW_URL_REGEX.sub('', cleaned)
        cleaned = USERNAME_REGEX.sub('', cleaned)

        for promo in PROMO_PHRASES:
            cleaned = promo.sub('', cleaned)

        # Cleanup excessive whitespace
        cleaned = re.sub(r'[ \\t]+', ' ', cleaned)
        cleaned = re.sub(r'\\n\\s*\\n\\s*\\n+', '\\n\\n', cleaned)
        cleaned = cleaned.strip()

    if watermark and watermark.strip():
        cleaned = f"{cleaned}\\n\\n{watermark.strip()}" if cleaned else watermark.strip()

    return cleaned

# ==================== VIDEO 5-SEC TRIMMER ====================
def trim_video_first_5_seconds(input_path, output_path, cut_seconds=5.0):
    """
    Cuts the first 5 seconds using FFmpeg fast stream copy.
    Falls back to re-encoding if keyframe copy fails.
    """
    # 1. Try fast stream copy (instant, 0 quality loss)
    cmd_copy = [
        'ffmpeg', '-y',
        '-ss', str(cut_seconds),
        '-i', input_path,
        '-c', 'copy',
        '-avoid_negative_ts', 'make_zero',
        output_path
    ]
    res = subprocess.run(cmd_copy, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if res.returncode == 0 and os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
        return True

    # 2. Fallback to re-encoding if stream copy fails
    print("Stream copy failed, re-encoding with x264...")
    cmd_encode = [
        'ffmpeg', '-y',
        '-ss', str(cut_seconds),
        '-i', input_path,
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '22',
        '-c:a', 'aac',
        '-b:a', '128k',
        output_path
    ]
    res_encode = subprocess.run(cmd_encode, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return res_encode.returncode == 0

def generate_video_thumbnail(video_path, thumb_path, at_seconds=5.5):
    """Generates a JPG thumbnail immediately following the trimmed point."""
    cmd = [
        'ffmpeg', '-y',
        '-ss', str(at_seconds),
        '-i', video_path,
        '-vframes', '1',
        '-q:v', '2',
        thumb_path
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return os.path.exists(thumb_path)

# ==================== MAIN TELETHON CLIENT ====================
client = TelegramClient('teletrim_session', API_ID, API_HASH)

async def process_video_message(message, route_config):
    """Handles downloading, trimming 5 seconds, sanitizing caption, and re-uploading."""
    dest_chat = route_config['dest']
    cut_seconds = route_config.get('cut_seconds', 5.0)
    watermark = route_config.get('watermark', '')

    raw_caption = message.message or ''
    cleaned_caption = sanitize_caption(raw_caption, watermark)

    print(f"\\n[+] Processing Video (Msg ID: {message.id})...")
    print(f"    Raw Caption: {raw_caption[:50]}...")
    print(f"    Cleaned Caption: {cleaned_caption[:50]}...")

    input_file = os.path.join(DOWNLOAD_DIR, f"orig_{message.id}.mp4")
    trimmed_file = os.path.join(DOWNLOAD_DIR, f"trimmed_{message.id}.mp4")
    thumb_file = os.path.join(DOWNLOAD_DIR, f"thumb_{message.id}.jpg")

    try:
        # 1. Download Video
        print("    [1/4] Downloading from source channel...")
        await message.download_media(file=input_file)

        if not os.path.exists(input_file):
            print("    [!] Download failed.")
            return

        # 2. Trim first 5 seconds
        print(f"    [2/4] Cropping / Trimming first {cut_seconds} seconds with FFmpeg...")
        success = trim_video_first_5_seconds(input_file, trimmed_file, cut_seconds)
        if not success:
            print("    [!] Trimming failed, sending original as fallback.")
            trimmed_file = input_file

        # 3. Generate thumbnail
        print("    [3/4] Generating post-cut thumbnail...")
        has_thumb = generate_video_thumbnail(trimmed_file, thumb_file, at_seconds=cut_seconds + 0.5)

        # 4. Upload to Destination Group / Channel
        print(f"    [4/4] Relaying to destination: {dest_chat}...")
        thumb_arg = thumb_file if has_thumb else None

        await client.send_file(
            dest_chat,
            trimmed_file,
            caption=cleaned_caption,
            thumb=thumb_arg,
            supports_streaming=True
        )

        print(f"[✓] Success! Video relayed to {dest_chat} without links and first 5s cropped!\\n")

    except Exception as e:
        print(f"[!] Error processing message {message.id}: {e}")
    finally:
        # Cleanup temporary files
        for f in [input_file, trimmed_file, thumb_file]:
            if os.path.exists(f):
                try:
                    os.remove(f)
                except Exception:
                    pass

# Event listener for NEW incoming video messages
@client.on(events.NewMessage(chats=SOURCE_CHATS))
async def on_new_video(event):
    message = event.message
    if message.video or (message.document and 'video' in getattr(message.document, 'mime_type', '')):
        source_id = str(event.chat_id)
        source_user = f"@{event.chat.username}" if getattr(event.chat, 'username', None) else source_id

        # Match route
        route = ROUTE_MAPPINGS.get(source_user) or ROUTE_MAPPINGS.get(source_id)
        if not route and ROUTE_MAPPINGS:
            # Fallback to first active route
            route = list(ROUTE_MAPPINGS.values())[0]

        if route:
            await process_video_message(message, route)

# Function to scan and process all historical videos
async def scan_historical_videos(limit=50):
    print(f"\\n[*] Scanning historical videos from source groups (Limit: {limit})...")
    for source in SOURCE_CHATS:
        route = ROUTE_MAPPINGS.get(source)
        if not route:
            continue
        print(f"[*] Fetching past messages from {source}...")
        async for msg in client.iter_messages(source, limit=limit):
            if msg.video or (msg.document and 'video' in getattr(msg.document, 'mime_type', '')):
                await process_video_message(msg, route)
                await asyncio.sleep(2) # Avoid Telegram FloodWait

async def main():
    print("==================================================")
    print("       TeleTrim Automated Relayer Active         ")
    print("==================================================")
    print(f"[*] Source Channels: {SOURCE_CHATS}")
    print(f"[*] First {${defaultCutSeconds}}s Crop: ENABLED")
    print(f"[*] Link Removal Engine: ACTIVE")
    print("==================================================")

    await client.start(phone=PHONE_NUMBER if PHONE_NUMBER else None)
    print("[✓] Telegram Client Logged in successfully!")

    # Check if user wants to scan historical videos first
    if '--scan-old' in sys.argv:
        await scan_historical_videos(limit=100)

    print("[*] Listening for incoming new videos... (Press Ctrl+C to stop)")
    await client.run_until_disconnected()

if __name__ == '__main__':
    asyncio.run(main())
`;
}

export function generateRequirementsTxt(): string {
  return `telethon>=1.34.0
cryptg>=0.4.0
pillow>=10.0.0
`;
}

export function generateDockerfile(): string {
  return `FROM python:3.11-slim

# Install system dependencies including FFmpeg
RUN apt-get update && apt-get install -y --no-install-recommends \\
    ffmpeg \\
    git \\
    curl \\
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY bot.py .

# Run with python unbuffered output
ENV PYTHONUNBUFFERED=1

CMD ["python", "bot.py"]
`;
}

export function generateDockerCompose(): string {
  return `version: '3.8'

services:
  teletrim-bot:
    build: .
    restart: unless-stopped
    volumes:
      - ./teletrim_session.session:/app/teletrim_session.session
      - ./temp_downloads:/app/temp_downloads
    environment:
      - PYTHONUNBUFFERED=1
`;
}

export function generateDeploymentGuide(): string {
  return `# 🚀 TeleTrim - 24/7 VPS & Cloud Deployment Guide (Hindi + English)

## 📌 Requirements:
1. **Telegram API ID & API HASH**: Get them free from https://my.telegram.org (App Development tools).
2. **FFmpeg**: Required for cropping the first 5 seconds of videos.
3. **VPS Server or Local PC**: Any Linux VPS (Ubuntu 20.04/22.04), Railway.app, Koyeb, or your local PC.

---

## 🛠 Option 1: 1-Click Run on Ubuntu / Debian VPS

### Step 1: Connect to your VPS via SSH
\`\`\`bash
ssh root@your_vps_ip
\`\`\`

### Step 2: Install Python & FFmpeg
\`\`\`bash
sudo apt update && sudo apt install -y python3 python3-pip ffmpeg git screen
\`\`\`

### Step 3: Create directory and add files
\`\`\`bash
mkdir teletrim && cd teletrim
nano bot.py
# (Paste the generated bot.py code and press CTRL+O, ENTER, CTRL+X)

pip3 install telethon cryptg
\`\`\`

### Step 4: Run in 24/7 Background (Screen)
\`\`\`bash
screen -S teletrim
python3 bot.py
\`\`\`
- First time: Enter your phone number and the Telegram Login OTP sent to your Telegram app.
- To detach screen and keep it running 24/7: Press \`Ctrl + A\` then \`D\`.
- To resume screen later: \`screen -r teletrim\`.

### Optional: Scan All Old Videos
\`\`\`bash
python3 bot.py --scan-old
\`\`\`

---

## 🐳 Option 2: Run with Docker (Recommended)
\`\`\`bash
docker compose up -d --build
\`\`\`

---

## 💡 How It Works:
1. **Source Group Ingestion**: Monitors target group(s) for old and new video messages.
2. **Smart Link Scrubber**:
   - If caption has links (t.me, https, @mentions) -> automatically strips them cleanly.
   - If caption has NO links -> forwards with original caption as is!
3. **5-Second Crop/Trim**: Automatically slices \`00:00 - 00:05\` off every video using FFmpeg fast stream-copy without quality degradation.
4. **Relay**: Automatically uploads the trimmed video to your destination channel/group.
`;
}
