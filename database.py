import json
import os
import sqlite3
import hashlib
import secrets
from datetime import datetime, timedelta
from pathlib import Path
from typing import Tuple, Optional

DATA_DIR = Path(os.environ.get('DATA_DIR', str(Path(__file__).parent / 'data')))
DB_PATH = DATA_DIR / 'magnom.db'
UPLOAD_DIR = DATA_DIR / 'uploads'


def get_connection():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA journal_mode=WAL')
    conn.execute('PRAGMA synchronous=NORMAL')
    conn.execute('PRAGMA cache_size=-64000')
    conn.execute('PRAGMA temp_store=MEMORY')
    return conn


def _add_column_if_missing(conn, table: str, column: str, definition: str):
    columns = [row[1] for row in conn.execute(f'PRAGMA table_info({table})').fetchall()]
    if column not in columns:
        conn.execute(f'ALTER TABLE {table} ADD COLUMN {column} {definition}')


def init_db():
    with get_connection() as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL COLLATE NOCASE,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'member',
                status TEXT NOT NULL DEFAULT 'approved',
                created_at TEXT DEFAULT (datetime('now'))
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                username TEXT NOT NULL,
                user_role TEXT NOT NULL,
                message_type TEXT NOT NULL DEFAULT 'text',
                message TEXT NOT NULL DEFAULT '',
                file_path TEXT,
                metadata TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            )
        ''')
        _add_column_if_missing(conn, 'users', 'status', "TEXT NOT NULL DEFAULT 'approved'")
        _add_column_if_missing(conn, 'users', 'avatar_path', 'TEXT')
        _add_column_if_missing(conn, 'users', 'welcome_pending', 'INTEGER NOT NULL DEFAULT 0')
        _add_column_if_missing(conn, 'chat_messages', 'message_type', "TEXT NOT NULL DEFAULT 'text'")
        _add_column_if_missing(conn, 'chat_messages', 'file_path', 'TEXT')
        _add_column_if_missing(conn, 'chat_messages', 'metadata', 'TEXT')
        conn.execute("UPDATE users SET role = 'admin' WHERE role IN ('leader', 'officer')")
        conn.execute("UPDATE users SET status = 'approved' WHERE status IS NULL OR status = ''")
        conn.execute('''
            CREATE TABLE IF NOT EXISTS clan_members (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER UNIQUE NOT NULL,
                username TEXT NOT NULL,
                level INTEGER NOT NULL DEFAULT 1,
                rank TEXT NOT NULL DEFAULT 'Bronze I',
                role TEXT NOT NULL DEFAULT 'pro player',
                created_at TEXT DEFAULT (datetime('now'))
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS login_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                username TEXT NOT NULL,
                remember_me INTEGER NOT NULL DEFAULT 0,
                logged_in_at TEXT DEFAULT (datetime('now'))
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS remember_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token_hash TEXT NOT NULL UNIQUE,
                expires_at TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            )
        ''')
        conn.execute('DELETE FROM remember_tokens WHERE expires_at <= datetime(\'now\')')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS announcements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                body TEXT NOT NULL,
                author TEXT NOT NULL,
                pinned INTEGER NOT NULL DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now'))
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                event_date TEXT NOT NULL,
                event_time TEXT,
                created_by TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS gallery_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                caption TEXT NOT NULL DEFAULT '',
                file_path TEXT NOT NULL,
                uploaded_by TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS activity_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                kind TEXT NOT NULL,
                title TEXT NOT NULL,
                body TEXT NOT NULL DEFAULT '',
                actor TEXT NOT NULL DEFAULT '',
                actor_id INTEGER,
                ref_id INTEGER,
                audience TEXT NOT NULL DEFAULT 'all',
                created_at TEXT DEFAULT (datetime('now'))
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS push_subscriptions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                endpoint TEXT NOT NULL UNIQUE,
                p256dh TEXT NOT NULL,
                auth TEXT NOT NULL,
                user_agent TEXT NOT NULL DEFAULT '',
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS support_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                username TEXT NOT NULL,
                note TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'waiting',
                admin_id INTEGER,
                admin_username TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                claimed_at TEXT,
                ended_at TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        ''')
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_support_queue_status ON support_queue(status, created_at)"
        )
        conn.execute('''
            CREATE TABLE IF NOT EXISTS support_call_signals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entry_id INTEGER NOT NULL,
                from_user_id INTEGER NOT NULL,
                signal_type TEXT NOT NULL,
                payload TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (entry_id) REFERENCES support_queue(id) ON DELETE CASCADE
            )
        ''')
        signal_cols = {row[1] for row in conn.execute('PRAGMA table_info(support_call_signals)').fetchall()}
        if 'queue_id' in signal_cols and 'entry_id' not in signal_cols:
            conn.execute('ALTER TABLE support_call_signals RENAME COLUMN queue_id TO entry_id')
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_support_signals_entry ON support_call_signals(entry_id, id)"
        )
        _seed_site_content(conn)
        conn.commit()


def _seed_site_content(conn):
    count = conn.execute('SELECT COUNT(*) as c FROM announcements').fetchone()['c']
    if count == 0:
        seeds = [
            ('Welcome to MAGNOM Clan', 'We are an elite Rocket League community focused on teamwork, coaching, and climbing ranks together. Register to join the roster!', 'MAGNOM Admin', 1),
            ('MAGNOM AI is Live', 'Ask our AI coach anything — mechanics, rotations, camera settings, and rank-up strategies. Open the gear menu → Ask MAGNOM AI.', 'MAGNOM Admin', 0),
            ('Weekly Scrims Every Saturday', 'Join clan scrims to practice rotations and comms. Check Events for the latest schedule.', 'MAGNOM Coach', 0),
        ]
        conn.executemany(
            'INSERT INTO announcements (title, body, author, pinned) VALUES (?, ?, ?, ?)',
            seeds,
        )
    count = conn.execute('SELECT COUNT(*) as c FROM events').fetchone()['c']
    if count == 0:
        conn.executemany(
            'INSERT INTO events (title, description, event_date, event_time, created_by) VALUES (?, ?, ?, ?, ?)',
            [
                ('Clan Scrims', '3v3 scrims — focus on rotation and boost management.', '2026-07-12', '20:00', 'MAGNOM Admin'),
                ('Mechanics Training', 'Air roll + fast aerial drills with coaches.', '2026-07-15', '19:00', 'MAGNOM Coach'),
                ('Rank Review Night', 'Replay review session — submit your games in chat.', '2026-07-20', '21:00', 'MAGNOM Coach'),
            ],
        )


def list_all_users():
    with get_connection() as conn:
        return conn.execute(
            'SELECT id, username, role, status, avatar_path, welcome_pending, created_at FROM users ORDER BY username'
        ).fetchall()


def hash_password(password: str, salt: str = None) -> Tuple[str, str]:
    if salt is None:
        salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
    return digest.hex(), salt


def verify_password(password: str, password_hash: str, salt: str) -> bool:
    computed, _ = hash_password(password, salt)
    return secrets.compare_digest(computed, password_hash)


def find_user_by_username(username: str):
    with get_connection() as conn:
        return conn.execute(
            'SELECT * FROM users WHERE username = ? COLLATE NOCASE', (username,)
        ).fetchone()


def find_user_by_id(user_id: int):
    with get_connection() as conn:
        return conn.execute(
            'SELECT id, username, role, status, avatar_path, welcome_pending, created_at FROM users WHERE id = ?',
            (user_id,)
        ).fetchone()


def update_avatar(user_id: int, avatar_path: str):
    with get_connection() as conn:
        conn.execute('UPDATE users SET avatar_path = ? WHERE id = ?', (avatar_path, user_id))
        conn.commit()
    return find_user_by_id(user_id)


def set_welcome_pending(user_id: int, pending: bool):
    with get_connection() as conn:
        conn.execute(
            'UPDATE users SET welcome_pending = ? WHERE id = ?',
            (1 if pending else 0, user_id)
        )
        conn.commit()
    return find_user_by_id(user_id)


def create_user(username: str, password: str, role: str, status: str = 'approved'):
    password_hash, salt = hash_password(password)
    with get_connection() as conn:
        cursor = conn.execute(
            'INSERT INTO users (username, password_hash, salt, role, status) VALUES (?, ?, ?, ?, ?)',
            (username, password_hash, salt, role, status)
        )
        conn.commit()
        return find_user_by_id(cursor.lastrowid)


def update_password(user_id: int, new_password: str):
    password_hash, salt = hash_password(new_password)
    with get_connection() as conn:
        conn.execute(
            'UPDATE users SET password_hash = ?, salt = ? WHERE id = ?',
            (password_hash, salt, user_id)
        )
        conn.commit()


def update_username(user_id: int, username: str):
    with get_connection() as conn:
        conn.execute('UPDATE users SET username = ? WHERE id = ?', (username, user_id))
        conn.execute(
            'UPDATE clan_members SET username = ? WHERE user_id = ?',
            (username, user_id)
        )
        conn.commit()
    return find_user_by_id(user_id)


def get_user_count() -> int:
    with get_connection() as conn:
        row = conn.execute('SELECT COUNT(*) as count FROM users').fetchone()
        return row['count']


def update_user_role(user_id: int, role: str):
    with get_connection() as conn:
        conn.execute('UPDATE users SET role = ? WHERE id = ?', (role, user_id))
        conn.commit()
    return find_user_by_id(user_id)


def update_user_status(user_id: int, status: str):
    with get_connection() as conn:
        conn.execute('UPDATE users SET status = ? WHERE id = ?', (status, user_id))
        conn.commit()
    return find_user_by_id(user_id)


def count_admins():
    with get_connection() as conn:
        row = conn.execute(
            "SELECT COUNT(*) as count FROM users WHERE role = 'admin'"
        ).fetchone()
        return row['count']


def delete_user(user_id: int) -> bool:
    delete_remember_tokens_for_user(user_id)
    with get_connection() as conn:
        conn.execute('DELETE FROM support_queue WHERE user_id = ?', (user_id,))
        conn.execute('DELETE FROM push_subscriptions WHERE user_id = ?', (user_id,))
        conn.execute('DELETE FROM chat_messages WHERE user_id = ?', (user_id,))
        conn.execute('DELETE FROM clan_members WHERE user_id = ?', (user_id,))
        cursor = conn.execute('DELETE FROM users WHERE id = ?', (user_id,))
        conn.commit()
        return cursor.rowcount > 0


def list_clan_members():
    with get_connection() as conn:
        return conn.execute(
            '''SELECT m.id, m.user_id, m.username, m.level, m.rank, m.role, m.created_at,
                      u.avatar_path
               FROM clan_members m
               LEFT JOIN users u ON u.id = m.user_id
               ORDER BY m.username'''
        ).fetchall()


def find_clan_member_by_user_id(user_id: int):
    with get_connection() as conn:
        return conn.execute(
            'SELECT id, user_id, username, level, rank, role, created_at FROM clan_members WHERE user_id = ?',
            (user_id,)
        ).fetchone()


def find_clan_member_by_id(member_id: int):
    with get_connection() as conn:
        return conn.execute(
            '''SELECT m.id, m.user_id, m.username, m.level, m.rank, m.role, m.created_at,
                      u.avatar_path
               FROM clan_members m
               LEFT JOIN users u ON u.id = m.user_id
               WHERE m.id = ?''',
            (member_id,)
        ).fetchone()


def create_clan_member(user_id: int, username: str, level: int, rank: str, role: str):
    with get_connection() as conn:
        cursor = conn.execute(
            '''INSERT INTO clan_members (user_id, username, level, rank, role)
               VALUES (?, ?, ?, ?, ?)''',
            (user_id, username, level, rank, role)
        )
        conn.commit()
        return find_clan_member_by_id(cursor.lastrowid)


def update_clan_member(member_id: int, level: int, rank: str, role: str):
    with get_connection() as conn:
        conn.execute(
            'UPDATE clan_members SET level = ?, rank = ?, role = ? WHERE id = ?',
            (level, rank, role, member_id)
        )
        conn.commit()
    return find_clan_member_by_id(member_id)


def delete_clan_member(member_id: int) -> bool:
    with get_connection() as conn:
        cursor = conn.execute('DELETE FROM clan_members WHERE id = ?', (member_id,))
        conn.commit()
        return cursor.rowcount > 0


def clear_clan_members():
    with get_connection() as conn:
        conn.execute('DELETE FROM clan_members')
        conn.commit()


def list_available_clan_users():
    with get_connection() as conn:
        return conn.execute('''
            SELECT u.id, u.username
            FROM users u
            WHERE u.status = 'approved'
              AND u.id NOT IN (SELECT user_id FROM clan_members)
            ORDER BY u.username
        ''').fetchall()


def create_chat_message(
    user_id: int,
    username: str,
    user_role: str,
    message: str = '',
    message_type: str = 'text',
    file_path: Optional[str] = None,
    metadata: Optional[dict] = None
):
    meta_json = json.dumps(metadata) if metadata else None
    with get_connection() as conn:
        cursor = conn.execute(
            '''INSERT INTO chat_messages
               (user_id, username, user_role, message_type, message, file_path, metadata)
               VALUES (?, ?, ?, ?, ?, ?, ?)''',
            (user_id, username, user_role, message_type, message, file_path, meta_json)
        )
        row_id = cursor.lastrowid
        conn.commit()
        return get_chat_message_by_id(row_id)


def get_chat_message_by_id(message_id: int):
    with get_connection() as conn:
        return conn.execute(
            '''SELECT c.id, c.user_id, c.username, c.user_role, c.message_type, c.message,
                      c.file_path, c.metadata, c.created_at, u.avatar_path
               FROM chat_messages c
               LEFT JOIN users u ON u.id = c.user_id
               WHERE c.id = ?''',
            (message_id,)
        ).fetchone()


def get_chat_messages(after_id: int = 0, limit: int = 100):
    with get_connection() as conn:
        if after_id > 0:
            return conn.execute(
                '''SELECT c.id, c.user_id, c.username, c.user_role, c.message_type, c.message,
                          c.file_path, c.metadata, c.created_at, u.avatar_path
                   FROM chat_messages c
                   LEFT JOIN users u ON u.id = c.user_id
                   WHERE c.id > ? ORDER BY c.id ASC LIMIT ?''',
                (after_id, limit)
            ).fetchall()
        rows = conn.execute(
            '''SELECT c.id, c.user_id, c.username, c.user_role, c.message_type, c.message,
                      c.file_path, c.metadata, c.created_at, u.avatar_path
               FROM chat_messages c
               LEFT JOIN users u ON u.id = c.user_id
               ORDER BY c.id DESC LIMIT ?''',
            (limit,)
        ).fetchall()
        return rows[::-1]


def delete_chat_message(message_id: int) -> bool:
    with get_connection() as conn:
        row = conn.execute(
            'SELECT file_path FROM chat_messages WHERE id = ?', (message_id,)
        ).fetchone()
        if row and row['file_path']:
            file_path = UPLOAD_DIR / row['file_path']
            if file_path.exists():
                file_path.unlink()
        cursor = conn.execute('DELETE FROM chat_messages WHERE id = ?', (message_id,))
        conn.commit()
        return cursor.rowcount > 0


def _hash_remember_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode()).hexdigest()


def record_login(user_id: int, username: str, remember_me: bool = False):
    with get_connection() as conn:
        conn.execute(
            'INSERT INTO login_history (user_id, username, remember_me) VALUES (?, ?, ?)',
            (user_id, username, 1 if remember_me else 0)
        )
        conn.commit()


def create_remember_token(user_id: int, days: int = 30) -> str:
    raw = secrets.token_urlsafe(32)
    token_hash = _hash_remember_token(raw)
    expires_at = (datetime.utcnow() + timedelta(days=days)).strftime('%Y-%m-%d %H:%M:%S')
    with get_connection() as conn:
        conn.execute(
            'INSERT INTO remember_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
            (user_id, token_hash, expires_at)
        )
        conn.commit()
    return raw


def find_user_by_remember_token(raw_token: str):
    if not raw_token:
        return None
    token_hash = _hash_remember_token(raw_token)
    with get_connection() as conn:
        return conn.execute(
            '''SELECT u.* FROM remember_tokens t
               JOIN users u ON u.id = t.user_id
               WHERE t.token_hash = ? AND t.expires_at > datetime('now')''',
            (token_hash,)
        ).fetchone()


def delete_remember_token(raw_token: str):
    if not raw_token:
        return
    token_hash = _hash_remember_token(raw_token)
    with get_connection() as conn:
        conn.execute('DELETE FROM remember_tokens WHERE token_hash = ?', (token_hash,))
        conn.commit()


def delete_remember_tokens_for_user(user_id: int):
    with get_connection() as conn:
        conn.execute('DELETE FROM remember_tokens WHERE user_id = ?', (user_id,))
        conn.commit()


def get_public_stats():
    with get_connection() as conn:
        members = conn.execute('SELECT COUNT(*) as c FROM clan_members').fetchone()['c']
        users = conn.execute("SELECT COUNT(*) as c FROM users WHERE status = 'approved'").fetchone()['c']
        coaches = conn.execute(
            "SELECT COUNT(*) as c FROM clan_members WHERE role IN ('coach', 'leader')"
        ).fetchone()['c']
        announcements = conn.execute('SELECT COUNT(*) as c FROM announcements').fetchone()['c']
        events = conn.execute(
            "SELECT COUNT(*) as c FROM events WHERE event_date >= date('now')"
        ).fetchone()['c']
        return {
            'members': members,
            'users': users,
            'coaches': coaches,
            'announcements': announcements,
            'upcomingEvents': events,
        }


def list_announcements(limit=50):
    with get_connection() as conn:
        return conn.execute(
            '''SELECT id, title, body, author, pinned, created_at
               FROM announcements ORDER BY pinned DESC, created_at DESC LIMIT ?''',
            (limit,)
        ).fetchall()


def create_announcement(title: str, body: str, author: str, pinned: bool = False):
    with get_connection() as conn:
        cursor = conn.execute(
            'INSERT INTO announcements (title, body, author, pinned) VALUES (?, ?, ?, ?)',
            (title, body, author, 1 if pinned else 0)
        )
        conn.commit()
        return conn.execute(
            'SELECT id, title, body, author, pinned, created_at FROM announcements WHERE id = ?',
            (cursor.lastrowid,)
        ).fetchone()


def delete_announcement(announcement_id: int) -> bool:
    with get_connection() as conn:
        cursor = conn.execute('DELETE FROM announcements WHERE id = ?', (announcement_id,))
        conn.commit()
        return cursor.rowcount > 0


def list_events(upcoming_only=False, limit=50):
    with get_connection() as conn:
        if upcoming_only:
            return conn.execute(
                '''SELECT id, title, description, event_date, event_time, created_by, created_at
                   FROM events WHERE event_date >= date('now')
                   ORDER BY event_date ASC, event_time ASC LIMIT ?''',
                (limit,)
            ).fetchall()
        return conn.execute(
            '''SELECT id, title, description, event_date, event_time, created_by, created_at
               FROM events ORDER BY event_date DESC LIMIT ?''',
            (limit,)
        ).fetchall()


def create_event(title: str, description: str, event_date: str, event_time: str, created_by: str):
    with get_connection() as conn:
        cursor = conn.execute(
            '''INSERT INTO events (title, description, event_date, event_time, created_by)
               VALUES (?, ?, ?, ?, ?)''',
            (title, description, event_date, event_time or None, created_by)
        )
        conn.commit()
        return conn.execute(
            'SELECT id, title, description, event_date, event_time, created_by, created_at FROM events WHERE id = ?',
            (cursor.lastrowid,)
        ).fetchone()


def delete_event(event_id: int) -> bool:
    with get_connection() as conn:
        cursor = conn.execute('DELETE FROM events WHERE id = ?', (event_id,))
        conn.commit()
        return cursor.rowcount > 0


def list_gallery(limit=60):
    with get_connection() as conn:
        return conn.execute(
            '''SELECT id, caption, file_path, uploaded_by, created_at
               FROM gallery_items ORDER BY created_at DESC LIMIT ?''',
            (limit,)
        ).fetchall()


def create_gallery_item(caption: str, file_path: str, uploaded_by: str):
    with get_connection() as conn:
        cursor = conn.execute(
            'INSERT INTO gallery_items (caption, file_path, uploaded_by) VALUES (?, ?, ?)',
            (caption, file_path, uploaded_by)
        )
        conn.commit()
        return conn.execute(
            'SELECT id, caption, file_path, uploaded_by, created_at FROM gallery_items WHERE id = ?',
            (cursor.lastrowid,)
        ).fetchone()


def delete_gallery_item(item_id: int) -> bool:
    with get_connection() as conn:
        row = conn.execute(
            'SELECT file_path FROM gallery_items WHERE id = ?', (item_id,)
        ).fetchone()
        if row and row['file_path']:
            file_path = UPLOAD_DIR / row['file_path']
            if file_path.exists():
                file_path.unlink()
        cursor = conn.execute('DELETE FROM gallery_items WHERE id = ?', (item_id,))
        conn.commit()
        return cursor.rowcount > 0


def log_activity(kind: str, title: str, body: str = '', actor: str = '',
                   actor_id: int = None, ref_id: int = None, audience: str = 'all') -> int:
    try:
        with get_connection() as conn:
            cursor = conn.execute(
                '''INSERT INTO activity_log (kind, title, body, actor, actor_id, ref_id, audience)
                   VALUES (?, ?, ?, ?, ?, ?, ?)''',
                (kind, title, (body or '')[:500], actor or '', actor_id, ref_id, audience)
            )
            conn.commit()
            return cursor.lastrowid
    except Exception:
        # Ensure table exists (older deployments) then retry once
        init_db()
        with get_connection() as conn:
            cursor = conn.execute(
                '''INSERT INTO activity_log (kind, title, body, actor, actor_id, ref_id, audience)
                   VALUES (?, ?, ?, ?, ?, ?, ?)''',
                (kind, title, (body or '')[:500], actor or '', actor_id, ref_id, audience)
            )
            conn.commit()
            return cursor.lastrowid


def list_activities(after_id: int = 0, limit: int = 50, is_admin: bool = False, is_coach: bool = False):
    del is_admin, is_coach  # all users see all site activity
    with get_connection() as conn:
        rows = conn.execute(
            '''SELECT id, kind, title, body, actor, actor_id, ref_id, audience, created_at
               FROM activity_log
               WHERE id > ?
               ORDER BY id ASC LIMIT ?''',
            (after_id, limit)
        ).fetchall()
        max_id = conn.execute('SELECT COALESCE(MAX(id), 0) as m FROM activity_log').fetchone()['m']
        return rows, max_id


def list_recent_activities(limit: int = 30, is_admin: bool = False, is_coach: bool = False):
    del is_admin, is_coach
    with get_connection() as conn:
        return conn.execute(
            '''SELECT id, kind, title, body, actor, actor_id, ref_id, audience, created_at
               FROM activity_log
               ORDER BY id DESC LIMIT ?''',
            (limit,)
        ).fetchall()


def upsert_push_subscription(user_id: int, endpoint: str, p256dh: str, auth: str,
                             user_agent: str = '') -> None:
    with get_connection() as conn:
        conn.execute(
            '''INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(endpoint) DO UPDATE SET
                   user_id = excluded.user_id,
                   p256dh = excluded.p256dh,
                   auth = excluded.auth,
                   user_agent = excluded.user_agent''',
            (user_id, endpoint, p256dh, auth, user_agent or '')
        )
        conn.commit()


def delete_push_subscription(endpoint: str) -> bool:
    with get_connection() as conn:
        cursor = conn.execute('DELETE FROM push_subscriptions WHERE endpoint = ?', (endpoint,))
        conn.commit()
        return cursor.rowcount > 0


def list_push_subscriptions(exclude_user_id: int = None):
    with get_connection() as conn:
        if exclude_user_id is not None:
            return conn.execute(
                '''SELECT id, user_id, endpoint, p256dh, auth
                   FROM push_subscriptions WHERE user_id != ?''',
                (exclude_user_id,)
            ).fetchall()
        return conn.execute(
            'SELECT id, user_id, endpoint, p256dh, auth FROM push_subscriptions'
        ).fetchall()


def _support_queue_positions(conn):
    rows = conn.execute(
        '''SELECT id FROM support_queue WHERE status = 'waiting' ORDER BY created_at ASC, id ASC'''
    ).fetchall()
    return {row['id']: idx + 1 for idx, row in enumerate(rows)}


def _support_db_retry(fn):
    try:
        return fn()
    except sqlite3.OperationalError:
        init_db()
        return fn()


def get_support_queue_entry(entry_id: int):
    def _run():
        with get_connection() as conn:
            return conn.execute(
                '''SELECT id, user_id, username, note, status, admin_id, admin_username,
                          created_at, claimed_at, ended_at
                   FROM support_queue WHERE id = ?''',
                (entry_id,)
            ).fetchone()
    return _support_db_retry(_run)


def get_user_active_support_entry(user_id: int):
    def _run():
        with get_connection() as conn:
            return conn.execute(
                '''SELECT id, user_id, username, note, status, admin_id, admin_username,
                          created_at, claimed_at, ended_at
                   FROM support_queue
                   WHERE user_id = ? AND status IN ('waiting', 'active')
                   ORDER BY id DESC LIMIT 1''',
                (user_id,)
            ).fetchone()
    return _support_db_retry(_run)


def join_support_queue(user_id: int, username: str, note: str = '') -> int:
    def _run():
        with get_connection() as conn:
            existing = conn.execute(
                '''SELECT id FROM support_queue
                   WHERE user_id = ? AND status IN ('waiting', 'active') LIMIT 1''',
                (user_id,)
            ).fetchone()
            if existing:
                return existing['id']
            cursor = conn.execute(
                '''INSERT INTO support_queue (user_id, username, note, status)
                   VALUES (?, ?, ?, 'waiting')''',
                (user_id, username, (note or '')[:500])
            )
            conn.commit()
            return cursor.lastrowid
    return _support_db_retry(_run)


def leave_support_queue(user_id: int) -> bool:
    with get_connection() as conn:
        cursor = conn.execute(
            '''UPDATE support_queue
               SET status = 'cancelled', ended_at = datetime('now')
               WHERE user_id = ? AND status IN ('waiting', 'active')''',
            (user_id,)
        )
        conn.commit()
        return cursor.rowcount > 0


def list_waiting_support_queue():
    with get_connection() as conn:
        return conn.execute(
            '''SELECT id, user_id, username, note, status, admin_id, admin_username,
                      created_at, claimed_at, ended_at
               FROM support_queue
               WHERE status = 'waiting'
               ORDER BY created_at ASC, id ASC'''
        ).fetchall()


def list_active_support_queue():
    with get_connection() as conn:
        return conn.execute(
            '''SELECT id, user_id, username, note, status, admin_id, admin_username,
                      created_at, claimed_at, ended_at
               FROM support_queue
               WHERE status = 'active'
               ORDER BY claimed_at ASC, id ASC'''
        ).fetchall()


def count_waiting_support_queue() -> int:
    with get_connection() as conn:
        return conn.execute(
            "SELECT COUNT(*) as c FROM support_queue WHERE status = 'waiting'"
        ).fetchone()['c']


def claim_support_queue_entry(entry_id: int, admin_id: int, admin_username: str) -> bool:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id, status FROM support_queue WHERE id = ?", (entry_id,)
        ).fetchone()
        if not row or row['status'] != 'waiting':
            return False
        conn.execute('DELETE FROM support_call_signals WHERE entry_id = ?', (entry_id,))
        cursor = conn.execute(
            '''UPDATE support_queue
               SET status = 'active', admin_id = ?, admin_username = ?,
                   claimed_at = datetime('now')
               WHERE id = ? AND status = 'waiting' ''',
            (admin_id, admin_username, entry_id)
        )
        conn.commit()
        return cursor.rowcount > 0


def complete_support_queue_entry(entry_id: int) -> bool:
    with get_connection() as conn:
        cursor = conn.execute(
            '''UPDATE support_queue
               SET status = 'done', ended_at = datetime('now')
               WHERE id = ? AND status IN ('waiting', 'active')''',
            (entry_id,)
        )
        conn.execute('DELETE FROM support_call_signals WHERE entry_id = ?', (entry_id,))
        conn.commit()
        return cursor.rowcount > 0


def support_queue_position(entry_id: int) -> int:
    with get_connection() as conn:
        positions = _support_queue_positions(conn)
        return positions.get(entry_id, 0)


def post_support_call_signal(entry_id: int, from_user_id: int, signal_type: str, payload: str) -> int:
    def _run():
        with get_connection() as conn:
            cursor = conn.execute(
                '''INSERT INTO support_call_signals (entry_id, from_user_id, signal_type, payload)
                   VALUES (?, ?, ?, ?)''',
                (entry_id, from_user_id, signal_type, payload)
            )
            conn.commit()
            return cursor.lastrowid
    return _support_db_retry(_run)


def list_support_call_signals(entry_id: int, after_id: int, exclude_user_id: int):
    def _run():
        with get_connection() as conn:
            return conn.execute(
                '''SELECT id, from_user_id, signal_type, payload, created_at
                   FROM support_call_signals
                   WHERE entry_id = ? AND id > ? AND from_user_id != ?
                   ORDER BY id ASC LIMIT 100''',
                (entry_id, after_id, exclude_user_id)
            ).fetchall()
    return _support_db_retry(_run)


def clear_support_call_signals(entry_id: int) -> None:
    with get_connection() as conn:
        conn.execute('DELETE FROM support_call_signals WHERE entry_id = ?', (entry_id,))
        conn.commit()
