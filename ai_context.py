"""Build live MAGNOM Clan context so the AI knows current site state."""

import time

from database import (
    get_public_stats,
    list_announcements,
    list_events,
    list_gallery,
    list_clan_members,
    list_recent_activities,
    get_chat_messages,
    find_clan_member_by_user_id,
    list_all_users,
)

MAX_CONTEXT_CHARS = 14000
FAST_CONTEXT_CHARS = 3500
_CONTEXT_CACHE = {}
_CONTEXT_TTL_SEC = 10


def get_cached_site_context(user=None, fast=False):
    """Return cached context snapshot (rebuilds every ~10s per user)."""
    key = (user.get('id') if user else 0, bool(fast))
    now = time.time()
    entry = _CONTEXT_CACHE.get(key)
    if entry and now - entry[0] < _CONTEXT_TTL_SEC:
        return entry[1]
    ctx = build_site_context(user, fast=fast)
    _CONTEXT_CACHE[key] = (now, ctx)
    return ctx


def invalidate_context_cache(user_id=None):
    if user_id is None:
        _CONTEXT_CACHE.clear()
    else:
        for key in list(_CONTEXT_CACHE):
            if key[0] == user_id:
                del _CONTEXT_CACHE[key]


def _clip(text, n=200):
    s = (text or '').replace('\n', ' ').strip()
    return s if len(s) <= n else s[: n - 1] + '…'


def _section(title, lines):
    if not lines:
        return ''
    body = '\n'.join(f'- {line}' for line in lines if line)
    return f'\n### {title}\n{body}\n' if body else ''


def build_site_context(user=None, fast=False):
    """Return a text snapshot of clan data for the AI system prompt."""
    max_chars = FAST_CONTEXT_CHARS if fast else MAX_CONTEXT_CHARS
    lim_news = 5 if fast else 10
    lim_events = 6 if fast else 12
    lim_gallery = 0 if fast else 8
    lim_activity = 0 if fast else 15
    lim_chat = 8 if fast else 25
    clip_body = 80 if fast else 120
    parts = ['## MAGNOM Clan — live data snapshot (answer from this when asked about the site)']

    stats = get_public_stats()
    parts.append(
        f'\n**Stats:** {stats["members"]} roster members, {stats["users"]} approved users, '
        f'{stats["coaches"]} coaches/leaders, {stats["announcements"]} news posts, '
        f'{stats["upcomingEvents"]} upcoming events.'
    )

    if user:
        role = user.get('role') or 'member'
        status = user.get('status') or 'approved'
        parts.append(
            f'\n**Current user:** {user.get("username")} (role: {role}, status: {status})'
        )
        member = find_clan_member_by_user_id(user['id'])
        if member:
            parts.append(
                f'**Roster profile:** level {member["level"]}, rank {member["rank"]}, '
                f'clan role {member["role"]}.'
            )
        else:
            parts.append('**Roster profile:** not on the public roster yet.')
    else:
        parts.append('\n**Current user:** guest (not logged in).')

    is_admin = bool(user and user.get('role') == 'admin')
    is_coach = bool(user and user.get('role') in ('coach', 'leader', 'admin'))

    if is_admin:
        pending = [u for u in list_all_users() if u['status'] == 'pending']
        if pending:
            names = ', '.join(u['username'] for u in pending[:15])
            extra = f' (+{len(pending) - 15} more)' if len(pending) > 15 else ''
            parts.append(f'\n**Pending signups (admin only):** {names}{extra}')

    news_lines = []
    for row in list_announcements(limit=lim_news):
        pin = ' [pinned]' if row['pinned'] else ''
        news_lines.append(
            f'{row["title"]}{pin} — by {row["author"]}: {_clip(row["body"], clip_body)}'
        )
    parts.append(_section('News & announcements', news_lines))

    event_lines = []
    for row in list_events(upcoming_only=True, limit=lim_events):
        event_lines.append(
            f'{row["event_date"]} {row["event_time"] or ""} — {row["title"]}: '
            f'{_clip(row["description"], 100)} (by {row["created_by"]})'
        )
    parts.append(_section('Events', event_lines))

    roster_lines = []
    for m in list_clan_members():
        roster_lines.append(
            f'{m["username"]}: level {m["level"]}, rank {m["rank"]}, role {m["role"]}'
        )
    parts.append(_section('Clan roster', roster_lines))

    gallery_lines = []
    if lim_gallery:
        for g in list_gallery(limit=lim_gallery):
            gallery_lines.append(f'{g["caption"] or "(no caption)"} — by {g["uploaded_by"]}')
    parts.append(_section('Gallery (recent)', gallery_lines))

    activity_lines = []
    if lim_activity:
        try:
            for a in list_recent_activities(limit=lim_activity, is_admin=is_admin, is_coach=is_coach):
                activity_lines.append(f'{a["actor"]}: {a["title"]} — {_clip(a["body"], 60)}')
        except Exception:
            pass
    parts.append(_section('Recent site activity', activity_lines))

    chat_lines = []
    for msg in get_chat_messages(limit=lim_chat):
        mtype = msg['message_type'] or 'text'
        if mtype == 'text' and (msg['message'] or '').strip():
            chat_lines.append(f'{msg["username"]}: {_clip(msg["message"], 100)}')
        elif mtype == 'image':
            chat_lines.append(f'{msg["username"]}: [shared an image]')
        elif mtype == 'voice':
            chat_lines.append(f'{msg["username"]}: [voice message]')
        elif mtype == 'training':
            chat_lines.append(f'{msg["username"]}: [training schedule]')
    parts.append(_section('Recent clan chat', chat_lines))

    if not fast:
        parts.append(_site_guide(is_admin, is_coach))

    text = '\n'.join(parts)
    if len(text) > max_chars:
        return text[: max_chars - 20] + '\n…[truncated]'
    return text


def _site_guide(is_admin, is_coach):
    guide = '''
### How the MAGNOM site works (features)
- **Landing page:** Home, About, News, Events, Gallery, Roster — visible to everyone.
- **Sign up:** Register → admin approves in Manage Users → then login works.
- **Roles:** Admin (full control), Coach/Leader (training schedules in chat), Member.
- **Dashboard sections:** Home, Roster, Chat, News, Events, Gallery, About, Account Settings.
- **Clan Chat:** text, images, voice notes; coaches can post training schedules.
- **Roster:** members have level (1–10000), Rocket League rank, and clan role.
- **MAGNOM AI:** this assistant — Rocket League coaching + general knowledge + live clan data above.
- **Notifications:** bell icon shows new activity (chat, news, events, roster changes, etc.).
- **Language:** English / Arabic toggle (top nav or landing).
- **Account Settings:** change display name (password required), password, profile picture.
- Never invent passwords, private tokens, or admin-only data the user cannot see.
'''
    if is_admin:
        guide += (
            '- **Admin:** Manage Users (approve/reject, roles), Add/Edit/Delete roster members, '
            'post news/events/gallery, delete events and chat messages.\n'
        )
    if is_coach:
        guide += '- **Coach:** Send training schedules from Clan Chat.\n'
    return guide
