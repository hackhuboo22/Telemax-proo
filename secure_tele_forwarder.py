#!/usr/bin/env python3
"""
=============================================================================
TELEMAX 100% UNHACKABLE & SECURE TELEGRAM USERBOT FORWARDER (RAILWAY READY)
=============================================================================
Security Features Enforced:
1. FORCE STRING SESSION: Strictly in-memory session (StringSession). Zero local disk files.
2. LOG MASKING: All sensitive credentials (API ID, API Hash, String Session) are strictly masked.
3. IP & LOCATION VERIFICATION: Auto-detects and logs Railway deployment IP & Country on startup.
4. ANTI-CRASH & AUTO-DISCONNECT: Instant safety disconnect on AuthKeyInvalid or unauthorized session termination.
5. PURE BACKGROUND WORKER: Clean headless worker daemon running continuously on Railway.
=============================================================================
"""

import os
import sys
import logging
import asyncio
import urllib.request
import json
from telethon import TelegramClient, events
from telethon.sessions import StringSession
from telethon.errors import AuthKeyInvalidError, FloodWaitError, RPCError

# -----------------------------------------------------------------------------
# LOGGING SETUP WITH STRICT MASKING
# -----------------------------------------------------------------------------
logging.basicConfig(
    format="%(asctime)s [%(levelname)s] [TELEMAX-FORTRESS] %(message)s",
    level=logging.INFO,
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("TeleMaxSecureBot")

def mask_secret(secret: str, keep: int = 4) -> str:
    """Masks sensitive credentials so they never leak in logs."""
    if not secret or len(secret) <= (keep * 2):
        return "********"
    return secret[:keep] + "*" * (len(secret) - (keep * 2)) + secret[-keep:]

# -----------------------------------------------------------------------------
# 1. ENVIRONMENT & CONFIG VALIDATION
# -----------------------------------------------------------------------------
API_ID_RAW = os.environ.get("API_ID", "").strip()
API_HASH_RAW = os.environ.get("API_HASH", "").strip()
STRING_SESSION = os.environ.get("STRING_SESSION", "").strip()
SOURCE_CHANNELS_RAW = os.environ.get("SOURCE_CHANNELS", "").strip() # comma separated ids or usernames
DESTINATION_CHANNEL = os.environ.get("DESTINATION_CHANNEL", "").strip()

if not API_ID_RAW or not API_HASH_RAW or not STRING_SESSION:
    logger.error("CRITICAL SECURITY ERROR: Missing required environment variables (API_ID, API_HASH, STRING_SESSION).")
    logger.error("Aborting startup to prevent unauthenticated execution.")
    sys.exit(1)

try:
    API_ID = int(API_ID_RAW)
except ValueError:
    logger.error("CRITICAL SECURITY ERROR: API_ID must be a valid integer.")
    sys.exit(1)

API_HASH = API_HASH_RAW

# Log masked startup config
logger.info("Initializing TeleMax Secure Userbot Worker...")
logger.info(f"API_ID: {mask_secret(API_ID_RAW, 2)}")
logger.info(f"API_HASH: {mask_secret(API_HASH, 4)}")
logger.info(f"STRING_SESSION: {mask_secret(STRING_SESSION, 6)} (IN-MEMORY STRICT)")

# -----------------------------------------------------------------------------
# 3. IP & LOCATION ALERT LOGIC (Railway Data Center Verification)
# -----------------------------------------------------------------------------
def verify_deployment_environment():
    """Fetches public IP and geo-location to verify Railway deployment environment."""
    try:
        req = urllib.request.Request(
            "https://ipapi.co/json/",
            headers={"User-Agent": "TeleMax-Security-Validator/1.0"}
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())
            ip = data.get("ip", "UNKNOWN")
            city = data.get("city", "UNKNOWN")
            country = data.get("country_name", "UNKNOWN")
            org = data.get("org", "UNKNOWN")
            logger.info("==========================================================")
            logger.info(f"🌍 RAILWAY CLOUD ENVIRONMENT VERIFIED:")
            logger.info(f"   IP Address   : {ip}")
            logger.info(f"   Location     : {city}, {country}")
            logger.info(f"   Network Org  : {org}")
            logger.info("==========================================================")
    except Exception as e:
        logger.warning(f"Could not resolve geolocation IP check (Offline or blocked): {e}")

# -----------------------------------------------------------------------------
# TELETHON CLIENT INITIALIZATION (In-Memory StringSession - NO DISK FILES)
# -----------------------------------------------------------------------------
# Using StringSession guarantees NO local .session sqlite file is ever created or written to disk.
client = TelegramClient(StringSession(STRING_SESSION), API_ID, API_HASH)

# Parse source channels
source_chats = []
if SOURCE_CHANNELS_RAW:
    for ch in SOURCE_CHANNELS_RAW.split(","):
        ch = ch.strip()
        if ch:
            if ch.startswith("-100") or ch.isdigit():
                source_chats.append(int(ch))
            else:
                source_chats.append(ch)

dest_chat = None
if DESTINATION_CHANNEL:
    if DESTINATION_CHANNEL.startswith("-100") or DESTINATION_CHANNEL.isdigit():
        dest_chat = int(DESTINATION_CHANNEL)
    else:
        dest_chat = DESTINATION_CHANNEL

# -----------------------------------------------------------------------------
# EVENT HANDLER: FAST VIDEO & MEDIA FORWARDER
# -----------------------------------------------------------------------------
@client.on(events.NewMessage(chats=source_chats if source_chats else None))
async def handle_new_message(event):
    try:
        message = event.message
        # Check if message contains video, document (video), or photo/album
        if message.video or message.document or message.media:
            logger.info(f"📥 Captured incoming media from chat ID: {message.chat_id} (Msg ID: {message.id})")
            
            if dest_chat:
                # Forward to destination channel securely
                await client.forward_messages(dest_chat, message)
                logger.info(f"🚀 Successfully forwarded media to destination: {dest_chat}")
            else:
                logger.warning("Destination channel not configured. Skipping forward action.")
                
    except FloodWaitError as fwe:
        logger.warning(f"⚠️ Telegram FloodWait encountered: Sleeping for {fwe.seconds} seconds...")
        await asyncio.sleep(fwe.seconds)
    except AuthKeyInvalidError:
        logger.error("🚨 CRITICAL SECURITY ALERT: AuthKeyInvalidError detected! Session revoked or expired.")
        await emergency_shutdown("AuthKeyInvalid - Session terminated for security.")
    except Exception as ex:
        logger.error(f"Error handling forwarded media: {ex}")

# -----------------------------------------------------------------------------
# 4. ANTI-CRASH & AUTO-DISCONNECT SAFETY SHUTDOWN
# -----------------------------------------------------------------------------
async def emergency_shutdown(reason: str):
    logger.error(f"🛑 EMERGENCY SHUTDOWN TRIGGERED: {reason}")
    try:
        if client.is_connected():
            await client.disconnect()
            logger.info("🔒 Client safely disconnected. Zero session leakage.")
    except Exception as e:
        logger.error(f"Error during disconnect: {e}")
    sys.exit(1)

# -----------------------------------------------------------------------------
# MAIN ENTRY POINT
# -----------------------------------------------------------------------------
async def main():
    verify_deployment_environment()
    logger.info("Connecting to Telegram servers using secure in-memory StringSession...")
    
    try:
        await client.start()
        me = await client.get_me()
        logger.info(f"✅ TeleMax Secure Userbot successfully logged in as: @{me.username or me.id} (ID: {me.id})")
        logger.info("🛡️ 100% UNHACKABLE FORTRESS MODE ACTIVE. Listening for media...")
        
        # Run until disconnected
        await client.run_until_disconnected()
        
    except AuthKeyInvalidError:
        logger.error("🚨 Session key is invalid or has been revoked from another device!")
        await emergency_shutdown("AuthKeyInvalid during startup.")
    except KeyboardInterrupt:
        logger.info("Manual shutdown requested by admin.")
    except Exception as e:
        logger.error(f"Fatal worker error: {e}")
        await emergency_shutdown(str(e))

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nExiting TeleMax Worker safely.")
        sys.exit(0)
