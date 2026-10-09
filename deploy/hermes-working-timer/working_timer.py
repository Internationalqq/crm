"""One temporary, non-conversational Telegram timer per owned run."""
import asyncio
import logging
import time

logger = logging.getLogger(__name__)


async def working_timer(adapter, chat_id, metadata, is_current, message_ids,
                        interval=1, clock=time.monotonic, sleep=asyncio.sleep):
    if not is_current():
        return
    started = clock()
    try:
        result = await adapter.send(chat_id, '⏳ Работаю · 0:00', metadata=metadata)
    except Exception:
        logger.debug('Working timer send failed', exc_info=True)
        return  # Unknown delivery is never repeated.
    if not getattr(result, 'success', False) or not getattr(result, 'message_id', None):
        return
    message_id = str(result.message_id)
    message_ids.append(message_id)
    while is_current():
        await sleep(interval)
        if not is_current():
            return
        elapsed = max(0, int(clock() - started))
        text = f'⏳ Работаю · {elapsed // 60}:{elapsed % 60:02d}'
        try:
            result = await adapter.edit_message(chat_id, message_id, text)
        except Exception:
            logger.debug('Working timer edit failed', exc_info=True)
            return
        if not getattr(result, 'success', False):
            return  # Keep the known ID for post-delivery cleanup; do not send a duplicate.
