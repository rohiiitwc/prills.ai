import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from telethon import TelegramClient, events
from telethon.sessions import StringSession
from telethon.errors import (
    SessionPasswordNeededError,
    PhoneNumberInvalidError,
    PhoneCodeInvalidError,
    PhoneCodeExpiredError,
    PasswordHashInvalidError
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from backend.app.config import settings
from backend.app.database import AsyncSessionLocal
from backend.app.models import TelegramSource, TelegramMessage, ParsedSignal, SignalAuditLog, TelegramAuthSession
from backend.app.parser import parse_telegram_message
from backend.app.matcher import match_result_to_signal
from backend.app.websocket_manager import ws_manager

logger = logging.getLogger("telegram_service")
logging.basicConfig(level=logging.INFO)

class TelegramService:
    def __init__(self):
        self.client: Optional[TelegramClient] = None
        self.api_id: int = settings.TELEGRAM_API_ID
        self.api_hash: str = settings.TELEGRAM_API_HASH
        self.session_string: str = settings.TELEGRAM_SESSION_STRING
        
        self.phone_number: Optional[str] = settings.TELEGRAM_PHONE_NUMBER or None
        self.phone_code_hash: Optional[str] = None
        
        self.is_connected: bool = False
        self.is_authorized: bool = False
        self.connection_status: str = "DISCONNECTED" # DISCONNECTED, AUTH_REQUIRED, CONNECTING, CONNECTED, ERROR
        self.error_message: Optional[str] = None
        self.last_sync_at: Optional[datetime] = None
        
        self.channel_map: Dict[str, TelegramSource] = {} # username -> TelegramSource
        self.entity_id_map: Dict[int, TelegramSource] = {} # entity_id or peer_id -> TelegramSource
        self.resolved_entities: list = []
        self._listener_task: Optional[asyncio.Task] = None

    async def initialize(self):
        """Initializes sources in DB and attempts Telegram connection if credentials exist."""
        async with AsyncSessionLocal() as db:
            # 1. Ensure the two exact required sources are in the database
            await self._ensure_sources(db)
            
            # 2. Check stored session in DB if not in settings
            if not self.session_string:
                stmt = select(TelegramAuthSession).where(
                    and_(
                        TelegramAuthSession.auth_state == "AUTHENTICATED",
                        TelegramAuthSession.session_string.isnot(None)
                    )
                ).order_by(TelegramAuthSession.id.desc()).limit(1)
                res = await db.execute(stmt)
                auth_sess = res.scalar_one_or_none()
                if auth_sess and auth_sess.session_string:
                    self.session_string = auth_sess.session_string

        # 3. Check if API credentials are provided
        if self.api_id and self.api_hash:
            await self.start_client()
        else:
            self.connection_status = "AUTH_REQUIRED"
            self.error_message = "Telegram API ID and API Hash required. Please configure in settings or Admin UI."
            logger.info("Telegram API credentials not configured yet.")

    async def _ensure_sources(self, db: AsyncSession):
        """Ensures the two required channels exist in the database with exact links and names."""
        sources_to_ensure = [
            {
                "name": settings.SOURCE_1_NAME, # QUOTEX OFFICIAL VIP BOT
                "link": settings.SOURCE_1_LINK, # https://t.me/quotexofficialvipbot
                "username": settings.SOURCE_1_USERNAME, # quotexofficialvipbot
                "category": settings.SOURCE_1_CATEGORY # LIVE
            },
            {
                "name": settings.SOURCE_2_NAME, # Quotex Vip Bot Signal
                "link": settings.SOURCE_2_LINK, # https://t.me/quotex0o
                "username": settings.SOURCE_2_USERNAME, # quotex0o
                "category": settings.SOURCE_2_CATEGORY # OTC
            }
        ]

        for s_data in sources_to_ensure:
            stmt = select(TelegramSource).where(TelegramSource.username == s_data["username"])
            res = await db.execute(stmt)
            existing = res.scalar_one_or_none()
            if not existing:
                source = TelegramSource(
                    name=s_data["name"],
                    link=s_data["link"],
                    username=s_data["username"],
                    category=s_data["category"],
                    is_active=True,
                    connection_status="DISCONNECTED"
                )
                db.add(source)
                await db.commit()
                await db.refresh(source)
                self.channel_map[s_data["username"].lower()] = source
            else:
                self.channel_map[s_data["username"].lower()] = existing

    async def start_client(self):
        """Starts Telethon client with MTProto and infinite reconnection."""
        try:
            self.connection_status = "CONNECTING"
            self.error_message = None

            session = StringSession(self.session_string or "")
            self.client = TelegramClient(
                session,
                self.api_id,
                self.api_hash,
                connection_retries=None,  # Infinite retry attempts
                retry_delay=5,
                auto_reconnect=True,
                flood_sleep_threshold=60
            )
            
            await self.client.connect()
            self.is_connected = True
            
            if await self.client.is_user_authorized():
                self.is_authorized = True
                self.connection_status = "CONNECTED"
                logger.info("Telegram client successfully authenticated!")
                await self._register_channel_listeners()
            else:
                self.is_authorized = False
                self.connection_status = "AUTH_REQUIRED"
                logger.info("Telegram client connected but user authorization is needed.")
                
        except Exception as e:
            self.connection_status = "ERROR"
            self.error_message = str(e)
            logger.error(f"Error starting Telegram client: {e}")

    async def _connection_watchdog(self):
        """Monitors Telegram connection continuously and auto-recovers after network drops."""
        cycle = 0
        while True:
            await asyncio.sleep(20)
            cycle += 1
            try:
                if self.client and self.is_authorized:
                    if not self.client.is_connected():
                        logger.warning("Telegram connection lost. Attempting auto-reconnect...")
                        self.connection_status = "CONNECTING"
                        self.is_connected = False
                        await self.client.connect()
                        if await self.client.is_user_authorized():
                            self.connection_status = "CONNECTED"
                            self.is_connected = True
                            logger.info("Telegram connection successfully re-established by watchdog.")
                            # Catch up on any messages missed during disconnect
                            asyncio.create_task(self._backfill_recent_messages(limit=300))
                    else:
                        if self.connection_status != "CONNECTED":
                            self.connection_status = "CONNECTED"
                            self.is_connected = True

                        # Periodic sync check every 60s to catch messages if laptop was sleeping
                        if cycle % 3 == 0:
                            asyncio.create_task(self.check_and_sync_gap())
            except Exception as e:
                logger.warning(f"Connection watchdog error: {e}")

    async def check_and_sync_gap(self):
        """Checks if Telegram channels have newer messages than the database and syncs if needed."""
        if not self.client or not self.is_connected or not self.is_authorized:
            return
        try:
            async with AsyncSessionLocal() as db:
                for username, source in self.channel_map.items():
                    stmt = select(func.max(TelegramMessage.message_id)).where(TelegramMessage.source_id == source.id)
                    max_db_id = (await db.execute(stmt)).scalar() or 0
                    entity = await self.client.get_entity(username)
                    latest_msgs = await self.client.get_messages(entity, limit=1)
                    if latest_msgs and latest_msgs[0].id > max_db_id:
                        logger.info(f"Message gap detected for @{username} (DB: {max_db_id}, Telegram: {latest_msgs[0].id}). Syncing...")
                        gap = latest_msgs[0].id - max_db_id
                        await self._backfill_recent_messages(limit=min(gap + 30, 300))
                        break
        except Exception as e:
            logger.debug(f"Gap sync check notice: {e}")

    async def _register_channel_listeners(self):
        """Subscribes to events from both configured Telegram channels and backfills recent messages."""
        if not self.client or not self.is_authorized:
            return

        self.resolved_entities = []
        for username, source in self.channel_map.items():
            try:
                entity = await self.client.get_entity(username)
                self.resolved_entities.append(entity)
                self.entity_id_map[entity.id] = source
                peer_id = await self.client.get_peer_id(entity)
                self.entity_id_map[peer_id] = source
                logger.info(f"Resolved channel @{username} -> entity_id={entity.id}, peer_id={peer_id}")
            except Exception as e:
                logger.error(f"Error resolving channel entity for @{username}: {e}")

        target_chats = self.resolved_entities if self.resolved_entities else list(self.channel_map.keys())
        logger.info(f"Registering Telegram message listeners for channels: {target_chats}")

        @self.client.on(events.NewMessage(chats=target_chats))
        async def new_message_handler(event):
            await self._handle_telegram_event(event, is_edit=False)

        @self.client.on(events.MessageEdited(chats=target_chats))
        async def edit_message_handler(event):
            await self._handle_telegram_event(event, is_edit=True)

        # Start the connection watchdog task
        asyncio.create_task(self._connection_watchdog())

        # Asynchronously backfill recent channel messages so current day signals appear immediately
        asyncio.create_task(self._backfill_recent_messages(limit=200))

    async def _backfill_recent_messages(self, limit: int = 200):
        """
        Backfills recent messages from both channels chronologically (oldest to newest by message ID).
        Ensures existing signals and results from today are loaded with accurate pairs and times.
        """
        if not self.client or not self.is_authorized:
            return

        for username, source in self.channel_map.items():
            try:
                logger.info(f"Backfilling up to {limit} recent messages from @{username}...")
                entity = await self.client.get_entity(username)
                messages = await self.client.get_messages(entity, limit=limit)
                # Sort strictly by message ID ascending so signals always precede their results
                sorted_messages = sorted(messages, key=lambda m: m.id)
                for msg in sorted_messages:
                    if not msg or not msg.message:
                        continue
                    try:
                        pub_at = msg.date.replace(tzinfo=timezone.utc) if msg.date else datetime.now(timezone.utc)
                        await self.process_incoming_message(
                            source=source,
                            message_id=msg.id,
                            raw_text=msg.message,
                            published_at=pub_at,
                            is_edit=False,
                            is_test_data=False
                        )
                    except Exception as msg_err:
                        logger.warning(f"Skipping backfill message #{msg.id} due to: {msg_err}")
                logger.info(f"Completed backfill from @{username}.")
            except Exception as e:
                logger.error(f"Error backfilling from channel @{username}: {e}")

        # Post-backfill reconciliation of any pending signals with stored results
        try:
            await self.reconcile_pending_signals()
        except Exception as e:
            logger.error(f"Error during signal reconciliation: {e}")

    async def reconcile_pending_signals(self):
        """
        Reconciles any PENDING signals with result messages in the database.
        Runs after backfill to guarantee that signals ingested out of order are matched.
        """
        async with AsyncSessionLocal() as db:
            stmt_pending = select(ParsedSignal).where(ParsedSignal.status == "PENDING")
            res_pending = await db.execute(stmt_pending)
            pending_list = res_pending.scalars().all()
            if not pending_list:
                return

            logger.info(f"Reconciling {len(pending_list)} pending signals against stored results...")
            for sig in pending_list:
                ref_sig_pub = sig.signal_published_at
                if ref_sig_pub and ref_sig_pub.tzinfo is not None:
                    ref_sig_pub = ref_sig_pub.replace(tzinfo=None)
                stmt_res = (
                    select(TelegramMessage)
                    .where(
                        and_(
                            TelegramMessage.source_id == sig.source_id,
                            TelegramMessage.published_at >= ref_sig_pub
                        )
                    )
                    .order_by(TelegramMessage.published_at.asc())
                    .limit(20)
                )
                res_msgs = await db.execute(stmt_res)
                candidate_msgs = res_msgs.scalars().all()

                for msg in candidate_msgs:
                    parsed = parse_telegram_message(
                        raw_text=msg.raw_text,
                        published_at=msg.published_at,
                        channel_category=sig.market_category
                    )
                    if parsed.get("type") == "RESULT":
                        r_data = parsed["data"]
                        if r_data.get("asset") == sig.asset:
                            outcome = r_data.get("reported_result") or "WIN"
                            sig.status = outcome
                            sig.reported_result = outcome
                            sig.result_telegram_message_id = msg.id
                            sig.result_reported_at = msg.published_at
                            sig.raw_result_text = msg.raw_text
                            sig.updated_at = datetime.now(timezone.utc)

                            # Clean up redundant NEEDS_REVIEW rows for this same result message
                            stmt_nr = select(ParsedSignal).where(
                                and_(
                                    ParsedSignal.result_telegram_message_id == msg.id,
                                    ParsedSignal.status == "NEEDS_REVIEW"
                                )
                            )
                            nr_rows = (await db.execute(stmt_nr)).scalars().all()
                            for nr in nr_rows:
                                await db.delete(nr)

                            await db.commit()
                            logger.info(f"Reconciled Signal #{sig.id} ({sig.asset}) to {outcome}")
                            break

    async def _handle_telegram_event(self, event, is_edit: bool = False):
        """Processes raw incoming Telegram event from channel."""
        try:
            chat = await event.get_chat()
            chat_id = getattr(chat, "id", None)
            chat_username = (getattr(chat, "username", None) or "").lower()
            event_chat_id = getattr(event, "chat_id", None)

            source = None
            if event_chat_id is not None and event_chat_id in self.entity_id_map:
                source = self.entity_id_map[event_chat_id]
            elif chat_id is not None and chat_id in self.entity_id_map:
                source = self.entity_id_map[chat_id]
            elif chat_username and chat_username in self.channel_map:
                source = self.channel_map[chat_username]

            if not source:
                logger.warning(f"Unmapped Telegram event: chat_id={chat_id}, event_chat_id={event_chat_id}, username={chat_username}")
                return

            raw_text = event.message.message or ""
            published_at = event.message.date.replace(tzinfo=timezone.utc) if event.message.date else datetime.now(timezone.utc)
            message_id = event.message.id

            await self.process_incoming_message(
                source=source,
                message_id=message_id,
                raw_text=raw_text,
                published_at=published_at,
                is_edit=is_edit,
                is_test_data=False
            )
        except Exception as e:
            logger.error(f"Error in telegram event handler: {e}")

    async def process_incoming_message(
        self,
        source: TelegramSource,
        message_id: int,
        raw_text: str,
        published_at: datetime,
        is_edit: bool = False,
        is_test_data: bool = False
    ) -> Dict[str, Any]:
        """
        Unified processing pipeline:
        1. Duplicate prevention
        2. Database message storage
        3. Message parsing (Signal / Result / Review)
        4. Signal persistence or Result matching
        5. Audit trail creation
        6. Real-time WebSocket broadcasting
        """
        website_received_at = datetime.now(timezone.utc)
        self.last_sync_at = website_received_at

        async with AsyncSessionLocal() as db:
            # 1. Check duplicate message for this source
            stmt = select(TelegramMessage).where(
                and_(
                    TelegramMessage.source_id == source.id,
                    TelegramMessage.message_id == message_id
                )
            )
            res = await db.execute(stmt)
            existing_msg = res.scalar_one_or_none()

            if existing_msg and not is_edit:
                logger.info(f"Duplicate message ignored: source {source.name}, message_id {message_id}")
                return {"status": "DUPLICATE_IGNORED", "message_id": message_id}

            if not existing_msg:
                try:
                    msg_record = TelegramMessage(
                        source_id=source.id,
                        message_id=message_id,
                        raw_text=raw_text,
                        published_at=published_at,
                        received_at=website_received_at,
                        is_edited=is_edit,
                        edit_timestamp=website_received_at if is_edit else None,
                        is_processed=True
                    )
                    db.add(msg_record)
                    await db.commit()
                    await db.refresh(msg_record)
                except Exception:
                    await db.rollback()
                    res = await db.execute(stmt)
                    existing_msg = res.scalar_one_or_none()
                    if existing_msg and not is_edit:
                        return {"status": "DUPLICATE_IGNORED", "message_id": message_id}
                    elif existing_msg:
                        msg_record = existing_msg
                    else:
                        return {"status": "ERROR", "message_id": message_id}
            else:
                msg_record = existing_msg
                msg_record.is_edited = True
                msg_record.edit_timestamp = website_received_at
                msg_record.raw_text = raw_text
                await db.commit()
                await db.refresh(msg_record)

            # Update source last_sync_at and status
            source_db = await db.get(TelegramSource, source.id)
            if source_db:
                source_db.last_sync_at = website_received_at
                await db.commit()

            # 2. Parse message
            parsed = parse_telegram_message(
                raw_text=raw_text,
                published_at=published_at,
                received_at=website_received_at,
                channel_category=source.category
            )

            result_payload = {"type": parsed.get("type"), "raw_text": raw_text}

            # 3. Handle by parsed message type
            if parsed["type"] == "SIGNAL":
                data = parsed["data"]
                
                # Prevent duplicate signal creation if message is edited or re-processed
                stmt_sig_existing = select(ParsedSignal).where(ParsedSignal.telegram_message_id == msg_record.id).limit(1)
                existing_signal = (await db.execute(stmt_sig_existing)).scalar_one_or_none()
                if existing_signal:
                    signal = existing_signal
                    signal.market_category = data["market_category"]
                    signal.asset = data["asset"]
                    signal.direction = data["direction"]
                    signal.direction_display = data["direction_display"]
                    signal.entry_time_announced = data["entry_time_announced"]
                    signal.entry_time_converted = data.get("entry_time_converted")
                    signal.expiry_duration = data["expiry_duration"]
                    signal.is_late = data["is_late"]
                    signal.late_by_seconds = data["late_by_seconds"]
                    signal.raw_signal_text = raw_text
                    signal.updated_at = website_received_at
                    await db.commit()
                    await db.refresh(signal)
                else:
                    signal = ParsedSignal(
                        source_id=source.id,
                        telegram_message_id=msg_record.id,
                        market_category=data["market_category"],
                        asset=data["asset"],
                        direction=data["direction"],
                        direction_display=data["direction_display"],
                        entry_time_announced=data["entry_time_announced"],
                        entry_time_converted=data.get("entry_time_converted"),
                        expiry_duration=data["expiry_duration"],
                        signal_published_at=published_at,
                        website_received_at=website_received_at,
                        is_late=data["is_late"],
                        late_by_seconds=data["late_by_seconds"],
                        status="PENDING",
                        reported_result=None,
                        raw_signal_text=raw_text,
                        is_test_data=is_test_data
                    )
                    db.add(signal)
                    await db.commit()
                    await db.refresh(signal)

                # Check if an out-of-order result was already received for this asset
                pub_at_naive = published_at.replace(tzinfo=None) if published_at and published_at.tzinfo is not None else published_at
                stmt_prev_res = (
                    select(ParsedSignal)
                    .where(
                        and_(
                            ParsedSignal.source_id == source.id,
                            ParsedSignal.asset == data["asset"],
                            ParsedSignal.status == "NEEDS_REVIEW",
                            ParsedSignal.signal_published_at >= pub_at_naive
                        )
                    )
                    .order_by(ParsedSignal.signal_published_at.asc())
                    .limit(1)
                )
                prev_res = (await db.execute(stmt_prev_res)).scalar_one_or_none()
                if prev_res:
                    signal.status = prev_res.reported_result or "WIN"
                    signal.reported_result = prev_res.reported_result or "WIN"
                    signal.result_telegram_message_id = prev_res.result_telegram_message_id
                    signal.result_reported_at = prev_res.result_reported_at
                    signal.raw_result_text = prev_res.raw_result_text
                    await db.delete(prev_res)
                    await db.commit()
                    await db.refresh(signal)

                audit = SignalAuditLog(
                    signal_id=signal.id,
                    action="CREATED" if not prev_res else "CREATED_AND_RESOLVED",
                    details=f"Signal ingested from {source.name} (Message #{message_id})",
                    new_values=f"Asset: {signal.asset}, Dir: {signal.direction_display}, Given Entry: {signal.entry_time_announced}, Converted: {signal.entry_time_converted}, Status: {signal.status}",
                    timestamp=website_received_at
                )
                db.add(audit)
                await db.commit()

                # Broadcast over WebSockets
                signal_dict = {
                    "id": signal.id,
                    "source_id": signal.source_id,
                    "source_name": "Quotex OTC Engine" if signal.market_category == "OTC" else "Global Forex Stream",
                    "market_category": signal.market_category,
                    "asset": signal.asset,
                    "direction": signal.direction,
                    "direction_display": signal.direction_display,
                    "entry_time_announced": signal.entry_time_announced,
                    "entry_time_converted": signal.entry_time_converted,
                    "expiry_duration": signal.expiry_duration,
                    "signal_published_at": signal.signal_published_at.isoformat(),
                    "website_received_at": signal.website_received_at.isoformat(),
                    "is_late": signal.is_late,
                    "late_by_seconds": signal.late_by_seconds,
                    "status": signal.status,
                    "reported_result": signal.reported_result,
                    "raw_signal_text": signal.raw_signal_text,
                    "is_test_data": signal.is_test_data
                }
                await ws_manager.broadcast_signal("NEW_SIGNAL", signal_dict)
                result_payload["signal"] = signal_dict

            elif parsed["type"] == "RESULT":
                data = parsed["data"]
                matched_signal, reason = await match_result_to_signal(
                    db=db,
                    source=source,
                    result_message=msg_record,
                    parsed_result=data
                )

                if matched_signal:
                    signal_dict = {
                        "id": matched_signal.id,
                        "source_id": matched_signal.source_id,
                        "source_name": "Quotex OTC Engine" if matched_signal.market_category == "OTC" else "Global Forex Stream",
                        "market_category": matched_signal.market_category,
                        "asset": matched_signal.asset,
                        "direction": matched_signal.direction,
                        "direction_display": matched_signal.direction_display,
                        "entry_time_announced": matched_signal.entry_time_announced,
                        "expiry_duration": matched_signal.expiry_duration,
                        "signal_published_at": matched_signal.signal_published_at.isoformat(),
                        "website_received_at": matched_signal.website_received_at.isoformat(),
                        "is_late": matched_signal.is_late,
                        "late_by_seconds": matched_signal.late_by_seconds,
                        "status": matched_signal.status,
                        "reported_result": matched_signal.reported_result,
                        "result_reported_at": matched_signal.result_reported_at.isoformat() if matched_signal.result_reported_at else None,
                        "raw_signal_text": matched_signal.raw_signal_text,
                        "raw_result_text": matched_signal.raw_result_text,
                        "review_reason": matched_signal.review_reason,
                        "is_test_data": matched_signal.is_test_data
                    }
                    await ws_manager.broadcast_signal("SIGNAL_UPDATED", signal_dict)
                    result_payload["updated_signal"] = signal_dict
                else:
                    result_payload["review_flag"] = reason

            elif parsed["type"] == "NEEDS_REVIEW":
                # Message flagged for review
                unparsed = ParsedSignal(
                    source_id=source.id,
                    telegram_message_id=msg_record.id,
                    market_category=source.category,
                    asset="UNKNOWN",
                    direction="UNKNOWN",
                    direction_display="UNKNOWN",
                    entry_time_announced="N/A",
                    expiry_duration="N/A",
                    signal_published_at=published_at,
                    website_received_at=website_received_at,
                    status="NEEDS_REVIEW",
                    raw_signal_text=raw_text,
                    review_reason=parsed.get("reason", "Unrecognized message structure"),
                    is_test_data=is_test_data
                )
                db.add(unparsed)
                await db.commit()
                await db.refresh(unparsed)
                result_payload["review_record_id"] = unparsed.id

            return result_payload

    # Telegram Login / Auth Flows
    def _mask_phone(self, phone: Optional[str]) -> str:
        """Masks a phone number for UI display (e.g. +91 •••••• 5577)."""
        if not phone:
            return ""
        clean = phone.strip()
        if len(clean) > 6:
            return clean[:3] + " •••••• " + clean[-4:]
        return "••••••"

    async def request_code(self, phone: Optional[str] = None, api_id: Optional[int] = None, api_hash: Optional[str] = None) -> Dict[str, Any]:
        """Step 1: Sends phone code to user via Telegram API."""
        try:
            if api_id:
                self.api_id = api_id
            if api_hash:
                self.api_hash = api_hash

            if not self.api_id or not self.api_hash:
                return {"success": False, "error": "Telegram API credentials are not configured on server."}

            target_phone = (phone.strip() if phone else None) or self.phone_number or settings.TELEGRAM_PHONE_NUMBER
            if not target_phone:
                return {"success": False, "error": "Telegram phone number is required."}

            self.phone_number = target_phone
            
            # Create fresh client for auth
            session = StringSession()
            self.client = TelegramClient(session, self.api_id, self.api_hash)
            await self.client.connect()

            sent = await self.client.send_code_request(self.phone_number)
            self.phone_code_hash = sent.phone_code_hash

            async with AsyncSessionLocal() as db:
                sess_record = TelegramAuthSession(
                    phone_number=self.phone_number,
                    phone_code_hash=self.phone_code_hash,
                    auth_state="CODE_REQUESTED"
                )
                db.add(sess_record)
                await db.commit()

            masked = self._mask_phone(self.phone_number)
            return {
                "success": True,
                "message": f"Verification code sent to {masked}. Please check your Telegram app."
            }
        except PhoneNumberInvalidError:
            return {"success": False, "error": "The phone number is invalid. Include country code (e.g. +91...)"}
        except Exception as e:
            logger.error(f"Failed to request telegram code: {e}")
            return {"success": False, "error": str(e)}

    async def submit_code(self, code: str, phone: Optional[str] = None) -> Dict[str, Any]:
        """Step 2: Submits OTP code received from Telegram."""
        try:
            if not self.client:
                return {"success": False, "error": "Please request a verification code first."}

            phone_num = phone or self.phone_number or settings.TELEGRAM_PHONE_NUMBER
            try:
                await self.client.sign_in(phone_num, code.strip(), phone_code_hash=self.phone_code_hash)
            except SessionPasswordNeededError:
                # 2FA password required
                return {
                    "success": True,
                    "requires_2fa": True,
                    "message": "Two-factor authentication (2FA) password required."
                }

            # Authenticated!
            self.is_authorized = True
            self.is_connected = True
            self.connection_status = "CONNECTED"
            saved_session = self.client.session.save()
            self.session_string = saved_session

            # Save in database
            async with AsyncSessionLocal() as db:
                sess_record = TelegramAuthSession(
                    phone_number=self.phone_number,
                    auth_state="AUTHENTICATED",
                    session_string=saved_session
                )
                db.add(sess_record)
                await db.commit()

            await self._register_channel_listeners()
            return {"success": True, "message": "Telegram authorized and connected successfully!"}

        except PhoneCodeInvalidError:
            return {"success": False, "error": "The verification code entered is incorrect."}
        except PhoneCodeExpiredError:
            return {"success": False, "error": "The verification code has expired. Request a new one."}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def submit_2fa(self, password: str) -> Dict[str, Any]:
        """Step 3: Submits 2FA password if account has 2FA enabled."""
        try:
            if not self.client:
                return {"success": False, "error": "Telegram client not initialized."}

            await self.client.sign_in(password=password)
            self.is_authorized = True
            self.is_connected = True
            self.connection_status = "CONNECTED"
            saved_session = self.client.session.save()
            self.session_string = saved_session

            async with AsyncSessionLocal() as db:
                sess_record = TelegramAuthSession(
                    phone_number=self.phone_number,
                    auth_state="AUTHENTICATED",
                    session_string=saved_session
                )
                db.add(sess_record)
                await db.commit()

            await self._register_channel_listeners()
            return {"success": True, "message": "2FA verified! Telegram connected successfully."}
        except PasswordHashInvalidError:
            return {"success": False, "error": "Invalid 2FA password. Please try again."}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_status(self) -> Dict[str, Any]:
        """Returns status of Telegram integration with zero credential or phone exposure."""
        return {
            "is_connected": self.is_connected and self.is_authorized,
            "status": self.connection_status,
            "error_message": self.error_message,
            "last_sync_at": self.last_sync_at.isoformat() if self.last_sync_at else None,
            "sources": [
                {
                    "name": settings.SOURCE_1_NAME,
                    "link": settings.SOURCE_1_LINK,
                    "username": settings.SOURCE_1_USERNAME,
                    "category": settings.SOURCE_1_CATEGORY,
                    "status": self.connection_status if self.is_authorized else "DISCONNECTED"
                },
                {
                    "name": settings.SOURCE_2_NAME,
                    "link": settings.SOURCE_2_LINK,
                    "username": settings.SOURCE_2_USERNAME,
                    "category": settings.SOURCE_2_CATEGORY,
                    "status": self.connection_status if self.is_authorized else "DISCONNECTED"
                }
            ]
        }

telegram_service = TelegramService()
