"""Sub-200ms answers for common questions — no LLM round-trip."""

import re

from database import (
    list_clan_members,
    list_events,
    list_announcements,
    get_public_stats,
    find_clan_member_by_user_id,
)


def try_instant_reply(message, user=None):
    """Return a full reply immediately, or None to use the LLM."""
    text = (message or '').strip()
    low = text.lower()
    if not low:
        return None

    if low in ('hi', 'hello', 'hey', 'yo', 'salam', 'hola', 'مرحبا', 'السلام', 'sup'):
        name = user.get('username') if user else None
        greet = f' Hey **{name}**!' if name else ''
        return (
            f'{greet} I\'m **MAGNOM AI** — ask me anything (homework, coding, Rocket League, '
            'or live clan roster, events, and news).'
        ).strip()

    if re.search(r'\b(roster|members?|who(?:\'s| is) on|clan list|team list)\b', low):
        return _format_roster()

    if re.search(r'\b(upcoming|next)\s+events?\b', low) or low in ('events', 'any events', 'our events'):
        return _format_events()

    if re.search(r'\b(news|announcements?|latest news)\b', low):
        return _format_news()

    if re.search(r'\b(how many|stats?|member count)\b', low):
        s = get_public_stats()
        return (
            f'**MAGNOM stats:** {s["members"]} roster members · {s["users"]} approved users · '
            f'{s["coaches"]} coaches · {s["upcomingEvents"]} upcoming events · '
            f'{s["announcements"]} news posts.'
        )

    if user and re.search(r'\b(my rank|my level|my profile|who am i)\b', low):
        m = find_clan_member_by_user_id(user['id'])
        if m:
            return (
                f'You are **{user["username"]}** — rank **{m["rank"]}**, level **{m["level"]}**, '
                f'role **{m["role"]}**.'
            )
        return f'You are logged in as **{user["username"]}** ({user.get("role", "member")}) — not on the public roster yet.'

    if any(k in low for k in ('register', 'sign up', 'signup', 'pending', 'approve')):
        return (
            '**Sign up:** Register on the login page → admin **Accepts** you in Manage Users → then log in.'
        )

    if any(k in low for k in ('logout', 'log out', 'sign out')):
        return 'Tap the **gear icon** (top-right) → **Log Out**.'

    if 'speedflip' in low or ('speed' in low and 'flip' in low) or low == 'kickoff':
        return (
            '**Speedflip kickoff:** diagonal dodge + air-roll cancel → hit the first small pad → '
            'land ready. Drill **50 kickoffs** per side daily.'
        )

    if any(k in low for k in ('camera settings', 'best camera', 'camera for rl')):
        return (
            '**Camera start:** distance **270–280**, height **100–110**, FOV **110**, '
            'stiffness **0.35–0.5**. Change one setting at a time.'
        )

    if low in ('ssl', 'supersonic legend'):
        return '**Supersonic Legend (SSL)** is the highest Rocket League rank — above Grand Champion III.'

    return None


def _format_roster():
    rows = list_clan_members()
    if not rows:
        return 'The **clan roster** is empty right now.'
    lines = [
        f'- **{m["username"]}** — {m["rank"]}, level {m["level"]}, {m["role"]}'
        for m in rows
    ]
    return '**MAGNOM Clan roster:**\n' + '\n'.join(lines)


def _format_events():
    rows = list_events(upcoming_only=True, limit=10)
    if not rows:
        return 'No **upcoming events** scheduled right now.'
    lines = [
        f'- **{r["title"]}** — {r["event_date"]} {r["event_time"] or ""}'.strip()
        + (f': {_clip(r["description"], 80)}' if r['description'] else '')
        for r in rows
    ]
    return '**Upcoming events:**\n' + '\n'.join(lines)


def _format_news():
    rows = list_announcements(limit=8)
    if not rows:
        return 'No **news** posts yet.'
    lines = []
    for r in rows:
        pin = ' 📌' if r['pinned'] else ''
        lines.append(f'- **{r["title"]}**{pin} ({r["author"]}): {_clip(r["body"], 100)}')
    return '**Latest news:**\n' + '\n'.join(lines)


def _clip(text, n=100):
    s = (text or '').replace('\n', ' ').strip()
    return s if len(s) <= n else s[: n - 1] + '…'
