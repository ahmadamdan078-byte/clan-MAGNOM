"""Web Push notifications for offline clan members."""

import base64
import json
import logging
import os
import threading
from pathlib import Path

from cryptography.hazmat.primitives import serialization

from database import DATA_DIR, delete_push_subscription, list_push_subscriptions

logger = logging.getLogger(__name__)

VAPID_EMAIL = os.environ.get('VAPID_CLAIM_EMAIL', 'mailto:admin@magnom.clan').strip()
VAPID_PATH = DATA_DIR / 'vapid.json'

ACTIVITY_SECTIONS = {
    'chat': 'chat',
    'news': 'news',
    'event': 'events',
    'gallery': 'gallery',
    'member': 'roster',
    'signup': 'roster',
    'training': 'chat',
    'roster': 'roster',
    'account': 'home',
    'support': 'support',
}

_vapid_lock = threading.Lock()
_vapid_cached = None


def _encode_public_key(public_key) -> str:
    raw = public_key.public_bytes(
        encoding=serialization.Encoding.X962,
        format=serialization.PublicFormat.UncompressedPoint,
    )
    return base64.urlsafe_b64encode(raw).decode('ascii').rstrip('=')


def get_vapid_keys():
    """Return (public_key_b64url, private_pem_bytes)."""
    global _vapid_cached
    with _vapid_lock:
        if _vapid_cached:
            return _vapid_cached

        pub = os.environ.get('VAPID_PUBLIC_KEY', '').strip()
        priv = os.environ.get('VAPID_PRIVATE_KEY', '').strip()
        if pub and priv:
            priv_pem = priv.encode('utf-8') if isinstance(priv, str) else priv
            _vapid_cached = (pub, priv_pem)
            return _vapid_cached

        if VAPID_PATH.exists():
            try:
                data = json.loads(VAPID_PATH.read_text(encoding='utf-8'))
                if data.get('public') and data.get('private'):
                    _vapid_cached = (data['public'], data['private'].encode('utf-8'))
                    return _vapid_cached
            except Exception:
                logger.exception('Failed to read VAPID keys from %s', VAPID_PATH)

        from py_vapid import Vapid

        vapid = Vapid()
        vapid.generate_keys()
        priv_pem = vapid.private_pem()
        pub_b64 = _encode_public_key(vapid.public_key)
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        VAPID_PATH.write_text(
            json.dumps({'public': pub_b64, 'private': priv_pem.decode('utf-8')}),
            encoding='utf-8',
        )
        _vapid_cached = (pub_b64, priv_pem)
        return _vapid_cached


def get_vapid_public_key() -> str:
    return get_vapid_keys()[0]


def _send_push(subscription, payload: dict) -> bool:
    try:
        from pywebpush import WebPushException, webpush
    except ImportError:
        logger.warning('pywebpush not installed — push disabled')
        return False

    _, priv_pem = get_vapid_keys()
    info = {
        'endpoint': subscription['endpoint'],
        'keys': {
            'p256dh': subscription['p256dh'],
            'auth': subscription['auth'],
        },
    }
    try:
        webpush(
            subscription_info=info,
            data=json.dumps(payload),
            vapid_private_key=priv_pem,
            vapid_claims={'sub': VAPID_EMAIL},
        )
        return True
    except WebPushException as exc:
        status = getattr(getattr(exc, 'response', None), 'status_code', None)
        if status in (404, 410):
            delete_push_subscription(subscription['endpoint'])
        else:
            logger.debug('Push failed (%s): %s', status, exc)
        return False
    except Exception:
        logger.exception('Push send error')
        return False


def broadcast_push(title: str, body: str, kind: str, exclude_user_id: int = None) -> None:
    section = ACTIVITY_SECTIONS.get(kind, 'home')
    payload = {
        'title': (title or 'MAGNOM Clan')[:120],
        'body': (body or '')[:200],
        'section': section,
        'url': '/',
    }
    subs = list_push_subscriptions(exclude_user_id=exclude_user_id)
    for row in subs:
        _send_push(dict(row), payload)


def broadcast_push_async(title: str, body: str, kind: str, exclude_user_id: int = None) -> None:
    threading.Thread(
        target=broadcast_push,
        args=(title, body, kind),
        kwargs={'exclude_user_id': exclude_user_id},
        daemon=True,
    ).start()
