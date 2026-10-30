import asyncio
import subprocess
import time
import logging
from export_snapshot import export_snapshot

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("auto_sync")

last_git_push_time = 0
GIT_PUSH_COOLDOWN = 30  # 30-second cooldown to sync website on time without spamming git

async def sync_loop():
    global last_git_push_time
    logger.info("PRILLS.AI Auto-Sync Engine active. Synchronizing website with Telegram on time...")
    
    while True:
        try:
            # 1. Export fresh database signals to frontend snapshot
            await export_snapshot()

            # 2. Check if snapshot changed and cooldown has passed
            now = time.time()
            if now - last_git_push_time >= GIT_PUSH_COOLDOWN:
                try:
                    status = subprocess.check_output(
                        ["git", "status", "--porcelain", "frontend/src/lib/snapshot.json"],
                        text=True
                    )
                    if "frontend/src/lib/snapshot.json" in status:
                        logger.info("New signals detected! Auto-syncing to GitHub/Vercel...")
                        subprocess.run(["git", "add", "frontend/src/lib/snapshot.json"], check=True)
                        subprocess.run(
                            ["git", "commit", "-m", "sync(telegram): auto-sync signals snapshot on time"],
                            check=True
                        )
                        subprocess.run(["git", "pull", "--rebase", "origin", "main"], check=False)
                        subprocess.run(["git", "push", "origin", "main"], check=True)
                        last_git_push_time = time.time()
                        logger.info("Successfully pushed updated snapshot to origin/main for real-time Vercel sync!")
                except Exception as git_err:
                    logger.debug(f"Git push notice: {git_err}")

        except Exception as e:
            logger.error(f"Auto-sync loop notice: {e}")

        # Check every 8 seconds for new signals
        await asyncio.sleep(8)

if __name__ == "__main__":
    asyncio.run(sync_loop())
