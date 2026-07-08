import json
import os
import uuid
from datetime import timedelta
from functools import wraps
from pathlib import Path

from flask import Flask, request, jsonify, session, send_from_directory, Response, stream_with_context

from database import (
    init_db,
    get_connection,
    find_user_by_username,
    find_user_by_id,
    find_user_by_remember_token,
    create_user,
    update_password,
    update_username,
    update_avatar,
    verify_password,
    get_user_count,
    list_all_users,
    update_user_role,
    update_user_status,
    set_welcome_pending,
    count_admins,
    delete_user,
    create_chat_message,
    get_chat_messages,
    get_chat_message_by_id,
    delete_chat_message,
    list_clan_members,
    find_clan_member_by_user_id,
    find_clan_member_by_id,
    create_clan_member,
    update_clan_member,
    delete_clan_member,
    clear_clan_members,
    list_available_clan_users,
    record_login,
    create_remember_token,
    delete_remember_token,
    get_public_stats,
    seed_bootstrap_admin,
    seed_clan_roster_from_file,
    list_announcements,
    create_announcement,
    delete_announcement,
    list_events,
    create_event,
    delete_event,
    list_gallery,
    create_gallery_item,
    delete_gallery_item,
    list_clips,
    find_clip_by_id,
    create_clip,
    delete_clip,
    log_activity,
    list_activities,
    list_recent_activities,
    upsert_push_subscription,
    delete_push_subscription,
    get_support_queue_entry,
    get_user_active_support_entry,
    join_support_queue,
    leave_support_queue,
    list_waiting_support_queue,
    list_active_support_queue,
    count_waiting_support_queue,
    claim_support_queue_entry,
    complete_support_queue_entry,
    support_queue_position,
    post_support_call_signal,
    list_support_call_signals,
    UPLOAD_DIR,
)
from push_notify import broadcast_push_async, get_vapid_public_key
from ai_support import ask_support_ai, stream_support_ai
from ai_general import ask_general_ai
from ai_context import get_cached_site_context

app = Flask(__name__, static_folder='.', static_url_path='')
_secret = os.environ.get('SECRET_KEY', '').strip()
_is_prod = bool(
    os.environ.get('FLASK_ENV') == 'production'
    or os.environ.get('RENDER')
    or os.environ.get('FLY_APP_NAME')
    or os.environ.get('GAE_ENV')
)
if _is_prod and not _secret:
    raise RuntimeError('SECRET_KEY environment variable must be set in production')
app.secret_key = _secret or 'magnom-dev-secret-change-in-production'
app.config['MAX_CONTENT_LENGTH'] = 12 * 1024 * 1024
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=30)
REMEMBER_COOKIE = 'magnom_remember'
REMEMBER_DAYS = 30
if _is_prod:
    app.config['SESSION_COOKIE_SECURE'] = True
    app.config['PREFERRED_URL_SCHEME'] = 'https'

_BLOCKED_STATIC_PREFIXES = (
    '/data/', '/mobile/', '/.git/', '/__pycache__/', '/bin/', '/.cursor/',
)
_BLOCKED_STATIC_SUFFIXES = ('.py', '.db', '.pyc', '.pem', '.env', '.sh', '.yaml', '.toml', '.jsonl')
_BLOCKED_STATIC_EXACT = {
    '/server.py', '/database.py', '/push_notify.py', '/ai_support.py', '/ai_general.py',
    '/ai_context.py', '/ai_instant.py', '/requirements.txt', '/Dockerfile', '/Procfile',
    '/fly.toml', '/app.yaml', '/.gitignore',
}


@app.before_request
def block_sensitive_files():
    path = (request.path or '').split('?', 1)[0]
    if path.startswith('/api/') or path.startswith('/uploads/') or path.startswith('/media/'):
        return None
    lower = path.lower()
    if lower in _BLOCKED_STATIC_EXACT:
        return jsonify({'error': 'Not found'}), 404
    if any(lower.startswith(p) for p in _BLOCKED_STATIC_PREFIXES):
        return jsonify({'error': 'Not found'}), 404
    if any(lower.endswith(s) for s in _BLOCKED_STATIC_SUFFIXES):
        return jsonify({'error': 'Not found'}), 404
    if '/data/' in lower or lower.startswith('/data'):
        return jsonify({'error': 'Not found'}), 404
    return None

from werkzeug.middleware.proxy_fix import ProxyFix
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

ALLOWED_IMAGE_EXT = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
ALLOWED_AUDIO_EXT = {'.webm', '.ogg', '.mp4', '.m4a', '.mpeg', '.mp3', '.wav', '.aac'}
ALLOWED_VIDEO_EXT = {'.mp4', '.webm', '.mov', '.m4v'}
MAX_CLIP_UPLOAD_MB = 80
AUDIO_MIME = {
    '.webm': 'audio/webm',
    '.ogg': 'audio/ogg',
    '.mp4': 'audio/mp4',
    '.m4a': 'audio/mp4',
    '.mpeg': 'audio/mpeg',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.aac': 'audio/aac',
}


MAX_MEMBER_LEVEL = 10000


def normalize_member_level(level):
    try:
        level = int(level)
    except (TypeError, ValueError):
        return None
    if level < 1 or level > MAX_MEMBER_LEVEL:
        return None
    return level


def is_admin(user):
    return user and user['role'] == 'admin'


def is_coach(user):
    return user and user['role'] == 'coach'


def _activity(kind, title, body='', actor='', actor_id=None, ref_id=None, audience='all'):
    try:
        log_activity(kind, title, body, actor, actor_id, ref_id, audience)
    except Exception:
        pass
    try:
        broadcast_push_async(title, body or '', kind, exclude_user_id=actor_id)
    except Exception:
        pass


def _row_activity(row):
    return {
        'id': row['id'],
        'kind': row['kind'],
        'title': row['title'],
        'body': row['body'],
        'actor': row['actor'],
        'actorId': row['actor_id'],
        'refId': row['ref_id'],
        'audience': row['audience'],
        'createdAt': row['created_at'],
    }


def avatar_url(row):
    if row is None:
        return None
    path = row['avatar_path'] if 'avatar_path' in row.keys() else None
    return f'/uploads/{path}' if path else None


def public_user(row):
    welcome = 0
    if 'welcome_pending' in row.keys() and row['welcome_pending'] is not None:
        welcome = int(row['welcome_pending'])
    return {
        'id': row['id'],
        'username': row['username'],
        'role': row['role'],
        'status': row['status'] if 'status' in row.keys() else 'approved',
        'avatarUrl': avatar_url(row),
        'welcomePending': bool(welcome),
        'createdAt': row['created_at'],
    }


def _remember_cookie_secure():
    return bool(app.config.get('SESSION_COOKIE_SECURE'))


def _set_remember_cookie(response, token):
    response.set_cookie(
        REMEMBER_COOKIE,
        token,
        max_age=REMEMBER_DAYS * 24 * 60 * 60,
        httponly=True,
        samesite='Lax',
        secure=_remember_cookie_secure(),
    )


def _clear_remember_cookie(response):
    response.set_cookie(
        REMEMBER_COOKIE,
        '',
        max_age=0,
        httponly=True,
        samesite='Lax',
        secure=_remember_cookie_secure(),
    )


def _approved_user(user):
    if not user:
        return None
    status = user['status'] if 'status' in user.keys() else 'approved'
    if status != 'approved':
        return None
    return user


def get_current_user():
    user_id = session.get('user_id')
    if user_id:
        user = _approved_user(find_user_by_id(user_id))
        if user:
            return user
        session.clear()

    raw_token = request.cookies.get(REMEMBER_COOKIE)
    if raw_token:
        user = _approved_user(find_user_by_remember_token(raw_token))
        if user:
            session['user_id'] = user['id']
            session.permanent = True
            return user
        delete_remember_token(raw_token)
    return None


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Authentication required'}), 401
        request.current_user = user
        return f(*args, **kwargs)
    return decorated


def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Authentication required'}), 401
        if not is_admin(user):
            return jsonify({'error': 'Admin access required'}), 403
        request.current_user = user
        return f(*args, **kwargs)
    return decorated


def save_upload(file_storage, allowed_ext):
    if not file_storage or not file_storage.filename:
        return None, 'No file provided'
    ext = Path(file_storage.filename).suffix.lower()
    if ext not in allowed_ext:
        return None, 'File type not allowed'
    filename = f'{uuid.uuid4().hex}{ext}'
    path = UPLOAD_DIR / filename
    file_storage.save(path)
    return filename, None


@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json(silent=True) or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''

    if len(username) < 3:
        return jsonify({'error': 'Username must be at least 3 characters'}), 400
    if len(password) < 4:
        return jsonify({'error': 'Password must be at least 4 characters'}), 400
    if find_user_by_username(username):
        return jsonify({'error': 'Username already exists'}), 409

    is_first = get_user_count() == 0
    if is_first:
        user = create_user(username, password, 'admin', 'approved')
        return jsonify({
            'message': 'Registration successful',
            'user': public_user(user),
            'pending': False,
        }), 201

    user = create_user(username, password, 'member', 'pending')
    _activity('signup', f'New signup: {username}', 'Waiting for admin approval', username, user['id'], user['id'])
    return jsonify({
        'message': 'Signup request sent. An admin must approve your account before you can log in.',
        'user': public_user(user),
        'pending': True,
    }), 201


@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''
    remember_me = bool(data.get('rememberMe'))

    user = find_user_by_username(username)
    if not user or not verify_password(password, user['password_hash'], user['salt']):
        return jsonify({'error': 'Invalid username or password'}), 401

    status = user['status'] if 'status' in user.keys() else 'approved'
    if status == 'pending':
        return jsonify({'error': 'Your account is pending admin approval'}), 403
    if status == 'declined':
        return jsonify({'error': 'Your signup request was declined. Contact an admin.'}), 403

    record_login(user['id'], user['username'], remember_me)
    session['user_id'] = user['id']
    session.permanent = remember_me

    response = jsonify({'user': public_user(user)})
    if remember_me:
        token = create_remember_token(user['id'], REMEMBER_DAYS)
        _set_remember_cookie(response, token)
    else:
        raw_token = request.cookies.get(REMEMBER_COOKIE)
        if raw_token:
            delete_remember_token(raw_token)
        _clear_remember_cookie(response)
    return response


@app.route('/api/auth/logout', methods=['POST'])
def logout():
    raw_token = request.cookies.get(REMEMBER_COOKIE)
    if raw_token:
        delete_remember_token(raw_token)
    session.clear()
    response = jsonify({'message': 'Logged out'})
    _clear_remember_cookie(response)
    return response


@app.route('/api/auth/me', methods=['GET'])
def me():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Authentication required'}), 401
    return jsonify({'user': public_user(user)})


@app.route('/api/auth/change-password', methods=['POST'])
@login_required
def change_password():
    data = request.get_json(silent=True) or {}
    current_password = data.get('currentPassword') or ''
    new_password = data.get('newPassword') or ''

    if not current_password or not new_password:
        return jsonify({'error': 'Current and new password are required'}), 400
    if len(new_password) < 4:
        return jsonify({'error': 'New password must be at least 4 characters'}), 400

    user = find_user_by_username(request.current_user['username'])
    if not verify_password(current_password, user['password_hash'], user['salt']):
        return jsonify({'error': 'Current password is incorrect'}), 401

    update_password(request.current_user['id'], new_password)
    _activity('account', f'{request.current_user["username"]} changed their password', '',
              request.current_user['username'], request.current_user['id'])
    return jsonify({'message': 'Password updated successfully'})


@app.route('/api/auth/change-username', methods=['POST'])
@login_required
def change_username():
    data = request.get_json(silent=True) or {}
    new_username = (data.get('username') or '').strip()
    current_password = data.get('currentPassword') or ''

    if len(new_username) < 3:
        return jsonify({'error': 'Username must be at least 3 characters'}), 400
    if len(new_username) > 32:
        return jsonify({'error': 'Username must be 32 characters or less'}), 400
    if not current_password:
        return jsonify({'error': 'Current password is required'}), 400

    user = find_user_by_username(request.current_user['username'])
    if not verify_password(current_password, user['password_hash'], user['salt']):
        return jsonify({'error': 'Current password is incorrect'}), 401

    if new_username.lower() == request.current_user['username'].lower():
        return jsonify({'error': 'That is already your username'}), 400

    existing = find_user_by_username(new_username)
    if existing and existing['id'] != request.current_user['id']:
        return jsonify({'error': 'Username is already taken'}), 409

    old_name = request.current_user['username']
    updated = update_username(request.current_user['id'], new_username)
    _activity('account', f'{old_name} is now {new_username}', 'Display name updated',
              new_username, request.current_user['id'])
    return jsonify({'user': public_user(updated), 'message': 'Username updated successfully'})


@app.route('/api/auth/avatar', methods=['POST'])
@login_required
def upload_avatar():
    filename, err = save_upload(request.files.get('file'), ALLOWED_IMAGE_EXT)
    if err:
        return jsonify({'error': err}), 400

    user = request.current_user
    old_path = user['avatar_path'] if 'avatar_path' in user.keys() else None
    if old_path:
        old_file = UPLOAD_DIR / old_path
        if old_file.is_file():
            try:
                old_file.unlink()
            except OSError:
                pass

    updated = update_avatar(user['id'], filename)
    _activity('account', f'{user["username"]} updated their profile picture', '',
              user['username'], user['id'])
    return jsonify({'user': public_user(updated), 'message': 'Profile picture updated'})


@app.route('/api/users', methods=['GET'])
@admin_required
def get_users():
    users = [public_user(u) for u in list_all_users()]
    return jsonify({'users': users})


@app.route('/api/users/<int:user_id>/role', methods=['PATCH'])
@admin_required
def set_user_role(user_id):
    data = request.get_json(silent=True) or {}
    role = data.get('role')

    if role not in ('admin', 'coach', 'member'):
        return jsonify({'error': 'Invalid role'}), 400

    target = find_user_by_id(user_id)
    if not target:
        return jsonify({'error': 'User not found'}), 404

    if target['id'] == request.current_user['id'] and role != 'admin':
        return jsonify({'error': 'You cannot remove your own admin access'}), 400

    if target['role'] == 'admin' and role != 'admin' and count_admins() <= 1:
        return jsonify({'error': 'At least one admin is required'}), 400

    user = update_user_role(user_id, role)
    _activity('roster', f'Role updated: {target["username"]}', f'Now {role}', request.current_user['username'],
              request.current_user['id'], user_id)
    return jsonify({'user': public_user(user)})


@app.route('/api/users/<int:user_id>/status', methods=['PATCH'])
@admin_required
def set_user_status(user_id):
    data = request.get_json(silent=True) or {}
    status = data.get('status')

    if status not in ('approved', 'declined', 'pending'):
        return jsonify({'error': 'Invalid status'}), 400

    target = find_user_by_id(user_id)
    if not target:
        return jsonify({'error': 'User not found'}), 404

    if target['role'] == 'admin' and status != 'approved':
        return jsonify({'error': 'Admin accounts must stay approved'}), 400

    user = update_user_status(user_id, status)
    clan_member = None

    if status == 'approved':
        set_welcome_pending(user_id, True)
        if not find_clan_member_by_user_id(user_id):
            clan_member = create_clan_member(
                user_id,
                target['username'],
                1,
                'Bronze I',
                'pro player',
            )
        user = find_user_by_id(user_id)
        _activity('member', f'{target["username"]} joined the clan!', 'Welcome to MAGNOM', target['username'], user_id, user_id)
    elif status == 'declined':
        _activity('signup', f'Signup declined: {target["username"]}', '', request.current_user['username'],
                  request.current_user['id'], user_id)

    payload = {'user': public_user(user)}
    if clan_member:
        payload['clanMember'] = public_clan_member(clan_member)
        payload['message'] = f"{target['username']} approved and added as Pro Player"
    return jsonify(payload)


@app.route('/api/auth/welcome-seen', methods=['POST'])
@login_required
def welcome_seen():
    user = set_welcome_pending(request.current_user['id'], False)
    return jsonify({'user': public_user(user)})


@app.route('/api/users/<int:user_id>', methods=['DELETE'])
@admin_required
def remove_user(user_id):
    target = find_user_by_id(user_id)
    if not target:
        return jsonify({'error': 'User not found'}), 404

    if target['id'] == request.current_user['id']:
        return jsonify({'error': 'You cannot delete your own account'}), 400

    if target['role'] == 'admin' and count_admins() <= 1:
        return jsonify({'error': 'Cannot delete the last admin'}), 400

    delete_user(user_id)
    _activity('roster', f'User removed: {target["username"]}', '', request.current_user['username'],
              request.current_user['id'], user_id)
    return jsonify({'message': 'User deleted successfully'})


def public_clan_member(row):
    return {
        'id': row['id'],
        'userId': row['user_id'],
        'name': row['username'],
        'username': row['username'],
        'level': row['level'],
        'rank': row['rank'],
        'role': row['role'],
        'avatarUrl': avatar_url(row),
    }


@app.route('/api/clan/members', methods=['GET'])
@login_required
def get_clan_members():
    members = [public_clan_member(m) for m in list_clan_members()]
    return jsonify({'members': members})


@app.route('/api/clan/available-users', methods=['GET'])
@admin_required
def get_available_clan_users():
    users = [{'id': u['id'], 'username': u['username']} for u in list_available_clan_users()]
    return jsonify({'users': users})


@app.route('/api/clan/members', methods=['POST'])
@admin_required
def add_clan_member():
    data = request.get_json(silent=True) or {}
    user_id = data.get('userId')
    level = normalize_member_level(data.get('level', 1))
    if level is None:
        return jsonify({'error': f'Level must be between 1 and {MAX_MEMBER_LEVEL}'}), 400
    rank = (data.get('rank') or 'Bronze I').strip()
    role = (data.get('role') or 'pro player').strip()

    if not user_id:
        return jsonify({'error': 'Select a registered user'}), 400
    if role not in ('pro player', 'coach', 'leader'):
        return jsonify({'error': 'Invalid clan role'}), 400

    user = find_user_by_id(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    if user['status'] != 'approved':
        return jsonify({'error': 'Only approved users who can log in may be added'}), 400
    if find_clan_member_by_user_id(user_id):
        return jsonify({'error': 'This user is already in the clan'}), 409

    member = create_clan_member(user_id, user['username'], level, rank, role)
    _activity('member', f'{user["username"]} added to roster', f'{rank} · Level {level}', request.current_user['username'],
              request.current_user['id'], member['id'])
    return jsonify({'member': public_clan_member(member)}), 201


@app.route('/api/clan/members/<int:member_id>', methods=['PUT'])
@admin_required
def edit_clan_member(member_id):
    data = request.get_json(silent=True) or {}
    level = normalize_member_level(data.get('level', 1))
    if level is None:
        return jsonify({'error': f'Level must be between 1 and {MAX_MEMBER_LEVEL}'}), 400
    rank = (data.get('rank') or 'Bronze I').strip()
    role = (data.get('role') or 'pro player').strip()

    if role not in ('pro player', 'coach', 'leader'):
        return jsonify({'error': 'Invalid clan role'}), 400
    if not find_clan_member_by_id(member_id):
        return jsonify({'error': 'Clan member not found'}), 404

    member = update_clan_member(member_id, level, rank, role)
    _activity('member', f'{member["username"]} updated on roster', f'{rank} · Level {level}', request.current_user['username'],
              request.current_user['id'], member_id)
    return jsonify({'member': public_clan_member(member)})


@app.route('/api/clan/members/<int:member_id>', methods=['DELETE'])
@admin_required
def remove_clan_member_route(member_id):
    existing = find_clan_member_by_id(member_id)
    if not existing:
        return jsonify({'error': 'Clan member not found'}), 404
    if not delete_clan_member(member_id):
        return jsonify({'error': 'Clan member not found'}), 404
    _activity('member', f'{existing["username"]} removed from roster', '', request.current_user['username'],
              request.current_user['id'], member_id)
    return jsonify({'message': 'Clan member removed'})


@app.route('/api/clan/members', methods=['DELETE'])
@admin_required
def clear_clan_members_route():
    clear_clan_members()
    _activity('member', 'Roster cleared', 'All clan members removed', request.current_user['username'],
              request.current_user['id'])
    return jsonify({'message': 'All clan members cleared'})


@app.route('/api/clan/seed-roster', methods=['POST'])
@admin_required
def seed_clan_roster_route():
    """Admin: re-apply roster from data/seed_roster.json onto this server DB."""
    data = request.get_json(silent=True) or {}
    force = bool(data.get('force'))
    result = seed_clan_roster_from_file(force=force)
    if not result.get('ok'):
        return jsonify({'error': result.get('reason') or 'Seed failed', **result}), 400
    _activity(
        'member',
        'Roster seeded',
        f"Added {result.get('added', 0)} · total {result.get('total', result.get('existing', 0))}",
        request.current_user['username'],
        request.current_user['id'],
    )
    return jsonify(result)


def public_chat_message(row):
    metadata = None
    if row['metadata']:
        try:
            metadata = json.loads(row['metadata'])
        except json.JSONDecodeError:
            metadata = None
    return {
        'id': row['id'],
        'userId': row['user_id'],
        'username': row['username'],
        'userRole': row['user_role'],
        'type': row['message_type'],
        'message': row['message'],
        'fileUrl': f'/uploads/{row["file_path"]}' if row['file_path'] else None,
        'avatarUrl': avatar_url(row),
        'metadata': metadata,
        'createdAt': row['created_at'],
    }


@app.route('/api/chat/messages', methods=['GET'])
@login_required
def chat_messages():
    after_id = request.args.get('after', 0, type=int)
    rows = get_chat_messages(after_id=after_id)
    return jsonify({'messages': [public_chat_message(r) for r in rows]})


@app.route('/api/chat/messages', methods=['POST'])
@login_required
def post_chat_message():
    user = request.current_user

    if request.content_type and 'multipart/form-data' in request.content_type:
        message_type = (request.form.get('type') or 'text').strip()
        caption = (request.form.get('message') or '').strip()

        if message_type == 'image':
            filename, err = save_upload(request.files.get('file'), ALLOWED_IMAGE_EXT)
            if err:
                return jsonify({'error': err}), 400
            row = create_chat_message(
                user['id'], user['username'], user['role'],
                message=caption, message_type='image', file_path=filename
            )
            _activity('chat', f'{user["username"]} sent a photo', caption or 'Image in clan chat',
                      user['username'], user['id'], row['id'])
            return jsonify({'message': public_chat_message(row)}), 201

        if message_type == 'voice':
            filename, err = save_upload(request.files.get('file'), ALLOWED_AUDIO_EXT)
            if err:
                return jsonify({'error': err}), 400
            row = create_chat_message(
                user['id'], user['username'], user['role'],
                message='', message_type='voice', file_path=filename
            )
            _activity('chat', f'{user["username"]} sent a voice message', 'Voice note in clan chat',
                      user['username'], user['id'], row['id'])
            return jsonify({'message': public_chat_message(row)}), 201

        return jsonify({'error': 'Invalid message type'}), 400

    data = request.get_json(silent=True) or {}
    message_type = (data.get('type') or 'text').strip()

    if message_type == 'training_schedule':
        if not is_coach(user):
            return jsonify({'error': 'Only coaches can send training schedules'}), 403
        title = (data.get('title') or '').strip()
        schedule_date = (data.get('date') or '').strip()
        schedule_time = (data.get('time') or '').strip()
        description = (data.get('description') or '').strip()
        if not title or not schedule_date:
            return jsonify({'error': 'Title and date are required'}), 400
        metadata = {
            'title': title,
            'date': schedule_date,
            'time': schedule_time,
            'description': description,
        }
        row = create_chat_message(
            user['id'], user['username'], user['role'],
            message=title, message_type='training_schedule', metadata=metadata
        )
        _activity('training', f'Training: {title}', f'{schedule_date}{" · " + schedule_time if schedule_time else ""}',
                  user['username'], user['id'], row['id'])
        return jsonify({'message': public_chat_message(row)}), 201

    message = (data.get('message') or '').strip()
    if not message:
        return jsonify({'error': 'Message cannot be empty'}), 400
    if len(message) > 500:
        return jsonify({'error': 'Message must be 500 characters or less'}), 400

    row = create_chat_message(
        user['id'], user['username'], user['role'], message=message, message_type='text'
    )
    _activity('chat', f'{user["username"]}: {message[:80]}{"…" if len(message) > 80 else ""}', message,
              user['username'], user['id'], row['id'])
    return jsonify({'message': public_chat_message(row)}), 201


@app.route('/api/chat/messages/<int:message_id>', methods=['DELETE'])
@admin_required
def remove_chat_message(message_id):
    row = get_chat_message_by_id(message_id)
    if not delete_chat_message(message_id):
        return jsonify({'error': 'Message not found'}), 404
    if row:
        _activity('chat', 'Chat message removed', row['message'][:80] if row['message'] else 'Message deleted',
                  request.current_user['username'], request.current_user['id'], message_id)
    return jsonify({'message': 'Message deleted'})


@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    path = request.path or ''
    if path.endswith(('.js', '.css', '.webmanifest', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico')):
        response.headers.setdefault('Cache-Control', 'public, max-age=3600')
    elif path == '/service-worker.js':
        response.headers['Cache-Control'] = 'no-cache'
        response.headers['Content-Type'] = 'application/javascript; charset=utf-8'
    elif path.startswith('/api/site/') or path == '/api/announcements' or path.startswith('/api/events') or path == '/api/gallery' or path.startswith('/api/clips'):
        if request.method == 'GET' and response.status_code == 200:
            response.headers.setdefault('Cache-Control', 'private, max-age=15')
    elif path.startswith('/api/activity'):
        if request.method == 'GET':
            response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate'
    return response


@app.route('/api/ai/chat', methods=['POST', 'OPTIONS'])
def ai_chat():
    if request.method == 'OPTIONS':
        return '', 204

    user = get_current_user()
    if not user:
        return jsonify({'error': 'Authentication required'}), 401

    data = request.get_json(silent=True) or {}
    message = (data.get('message') or '').strip()
    history = data.get('history') or []

    if not message:
        return jsonify({'error': 'Message cannot be empty'}), 400
    if len(message) > 4000:
        return jsonify({'error': 'Message is too long'}), 400
    if not isinstance(history, list):
        history = []

    try:
        user_dict = dict(user)
        site_context = get_cached_site_context(user_dict, fast=True)
        reply = ask_general_ai(message, history, user=user_dict, site_context=site_context)
    except Exception:
        reply = (
            'Sorry, the AI service is temporarily unavailable. '
            'Please try again in a moment.'
        )

    return jsonify({'reply': reply})


def _ai_site_context(fast=True):
    user_id = session.get('user_id')
    if not user_id:
        return get_cached_site_context(None, fast=fast)
    user = find_user_by_id(user_id)
    if not user:
        return get_cached_site_context(None, fast=fast)
    return get_cached_site_context(dict(user), fast=fast)


def _ai_current_user():
    user_id = session.get('user_id')
    if not user_id:
        return None
    user = find_user_by_id(user_id)
    return dict(user) if user else None


@app.route('/api/ai/warmup', methods=['GET', 'POST'])
@login_required
def ai_warmup():
    """Pre-build AI context so the first message feels instant."""
    _ai_site_context(fast=True)
    return jsonify({'ok': True})


@app.route('/api/support/chat', methods=['POST'])
@login_required
def support_chat():
    parsed, err, code = _parse_support_request()
    if err:
        return jsonify({'error': err}), code

    site_context = _ai_site_context(fast=True)
    ai_user = _ai_current_user()
    try:
        reply = ask_support_ai(
            parsed['message'],
            parsed['history'],
            image_bytes=parsed['image_bytes'],
            image_mime=parsed['image_mime'],
            site_context=site_context,
            user=ai_user,
        )
    except Exception:
        reply = (
            'Sorry, MAGNOM AI is busy right now. Please try again in a moment '
            'or ask an admin in Clan Chat.'
        )

    payload = {'reply': reply}
    if parsed['image_name']:
        payload['imageUrl'] = f'/uploads/{parsed["image_name"]}'
    return jsonify(payload)


def _parse_support_request():
    image_bytes = None
    image_mime = None
    image_name = None

    if request.content_type and 'multipart/form-data' in request.content_type:
        message = (request.form.get('message') or '').strip()
        try:
            history = json.loads(request.form.get('history') or '[]')
        except json.JSONDecodeError:
            history = []
        upload = request.files.get('file')
        if upload and upload.filename:
            filename, err = save_upload(upload, ALLOWED_IMAGE_EXT)
            if err:
                return None, err, 400
            image_name = filename
            path = UPLOAD_DIR / filename
            image_bytes = path.read_bytes()
            ext = path.suffix.lower()
            image_mime = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.webp': 'image/webp',
            }.get(ext, 'image/jpeg')
            if not message:
                message = 'Please look at this image and help me.'
    else:
        data = request.get_json(silent=True) or {}
        message = (data.get('message') or '').strip()
        history = data.get('history') or []

    if not message and not image_bytes:
        return None, 'Please type a question, use voice, or send a picture', 400
    if len(message) > 4000:
        return None, 'Message is too long', 400

    user_id = session.get('user_id')
    if user_id:
        user = find_user_by_id(user_id)
        if user and user['status'] != 'approved':
            return None, 'Your account is not approved yet', 403

    if not isinstance(history, list):
        history = []

    return {
        'message': message,
        'history': history,
        'image_bytes': image_bytes,
        'image_mime': image_mime,
        'image_name': image_name,
    }, None, None


@app.route('/api/support/chat/stream', methods=['POST'])
@login_required
def support_chat_stream():
    parsed, err, code = _parse_support_request()
    if err:
        return jsonify({'error': err}), code

    site_context = _ai_site_context(fast=True)
    ai_user = _ai_current_user()

    def generate():
        try:
            for token in stream_support_ai(
                parsed['message'],
                parsed['history'],
                image_bytes=parsed['image_bytes'],
                image_mime=parsed['image_mime'],
                site_context=site_context,
                user=ai_user,
            ):
                yield f'data: {json.dumps({"token": token})}\n\n'
            extra = {}
            if parsed['image_name']:
                extra['imageUrl'] = f'/uploads/{parsed["image_name"]}'
            if extra:
                yield f'data: {json.dumps(extra)}\n\n'
            yield 'data: [DONE]\n\n'
        except Exception:
            fallback = (
                'Sorry, MAGNOM AI hit a snag. Please try again in a moment.'
            )
            yield f'data: {json.dumps({"token": fallback})}\n\n'
            yield 'data: [DONE]\n\n'

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
        },
    )


def _row_announcement(row):
    return {
        'id': row['id'],
        'title': row['title'],
        'body': row['body'],
        'author': row['author'],
        'pinned': bool(row['pinned']),
        'createdAt': row['created_at'],
    }


def _row_event(row):
    return {
        'id': row['id'],
        'title': row['title'],
        'description': row['description'],
        'eventDate': row['event_date'],
        'eventTime': row['event_time'],
        'createdBy': row['created_by'],
        'createdAt': row['created_at'],
    }


def _row_gallery(row):
    return {
        'id': row['id'],
        'caption': row['caption'],
        'imageUrl': f'/media/{row["file_path"]}',
        'uploadedBy': row['uploaded_by'],
        'createdAt': row['created_at'],
    }


@app.route('/api/site/stats', methods=['GET'])
def site_stats():
    return jsonify(get_public_stats())


@app.route('/api/announcements', methods=['GET'])
def get_announcements():
    return jsonify({
        'announcements': [_row_announcement(r) for r in list_announcements()]
    })


@app.route('/api/announcements', methods=['POST'])
@admin_required
def post_announcement():
    data = request.get_json(silent=True) or {}
    title = (data.get('title') or '').strip()
    body = (data.get('body') or '').strip()
    pinned = bool(data.get('pinned'))
    if not title or not body:
        return jsonify({'error': 'Title and body are required'}), 400
    row = create_announcement(title, body, request.current_user['username'], pinned)
    _activity('news', f'News: {title}', body[:120], request.current_user['username'],
              request.current_user['id'], row['id'])
    return jsonify({'announcement': _row_announcement(row)}), 201


@app.route('/api/announcements/<int:item_id>', methods=['DELETE'])
@admin_required
def remove_announcement(item_id):
    if not delete_announcement(item_id):
        return jsonify({'error': 'Not found'}), 404
    _activity('news', 'Announcement removed', '', request.current_user['username'],
              request.current_user['id'], item_id)
    return jsonify({'message': 'Deleted'})


@app.route('/api/events', methods=['GET'])
def get_events():
    upcoming = request.args.get('upcoming') == '1'
    return jsonify({
        'events': [_row_event(r) for r in list_events(upcoming_only=upcoming)]
    })


@app.route('/api/events', methods=['POST'])
@login_required
def post_event():
    user = request.current_user
    if not (is_admin(user) or is_coach(user)):
        return jsonify({'error': 'Coach or admin access required'}), 403
    data = request.get_json(silent=True) or {}
    title = (data.get('title') or '').strip()
    description = (data.get('description') or '').strip()
    event_date = (data.get('eventDate') or '').strip()
    event_time = (data.get('eventTime') or '').strip()
    if not title or not event_date:
        return jsonify({'error': 'Title and date are required'}), 400
    row = create_event(title, description, event_date, event_time, user['username'])
    _activity('event', f'New event: {title}', f'{event_date}{" · " + event_time if event_time else ""}',
              user['username'], user['id'], row['id'])
    return jsonify({'event': _row_event(row)}), 201


@app.route('/api/events/<int:item_id>', methods=['DELETE'])
@login_required
def remove_event(item_id):
    user = request.current_user
    if not (is_admin(user) or is_coach(user)):
        return jsonify({'error': 'Coach or admin access required'}), 403
    if not delete_event(item_id):
        return jsonify({'error': 'Not found'}), 404
    _activity('event', 'Event removed', '', request.current_user['username'],
              request.current_user['id'], item_id)
    return jsonify({'message': 'Deleted'})


@app.route('/api/gallery', methods=['GET'])
def get_gallery():
    return jsonify({
        'items': [_row_gallery(r) for r in list_gallery()]
    })


@app.route('/api/gallery', methods=['POST'])
@admin_required
def post_gallery():
    caption = (request.form.get('caption') or '').strip()
    upload = request.files.get('file')
    filename, err = save_upload(upload, ALLOWED_IMAGE_EXT)
    if err:
        return jsonify({'error': err}), 400
    row = create_gallery_item(caption, filename, request.current_user['username'])
    _activity('gallery', 'New gallery photo', caption or 'Photo uploaded', request.current_user['username'],
              request.current_user['id'], row['id'])
    return jsonify({'item': _row_gallery(row)}), 201


@app.route('/api/gallery/<int:item_id>', methods=['DELETE'])
@admin_required
def remove_gallery(item_id):
    if not delete_gallery_item(item_id):
        return jsonify({'error': 'Not found'}), 404
    _activity('gallery', 'Gallery photo removed', '', request.current_user['username'],
              request.current_user['id'], item_id)
    return jsonify({'message': 'Deleted'})



def _detect_clip_platform(url: str) -> str:
    u = (url or '').lower()
    if 'youtube.com' in u or 'youtu.be' in u:
        return 'youtube'
    if 'twitch.tv' in u:
        return 'twitch'
    if 'medal.tv' in u:
        return 'medal'
    if 'streamable.com' in u:
        return 'streamable'
    if 'tiktok.com' in u:
        return 'tiktok'
    return 'link'


def _youtube_embed(url: str):
    import re
    m = re.search(r'(?:youtu\.be/|v=|embed/|shorts/)([A-Za-z0-9_-]{6,})', url or '')
    if not m:
        return None
    return f'https://www.youtube.com/embed/{m.group(1)}'


def _row_clip(row):
    item = dict(row)
    url = item.get('url') or ''
    file_path = item.get('file_path') or ''
    return {
        'id': item['id'],
        'title': item.get('title') or '',
        'url': url,
        'fileUrl': f'/uploads/{file_path}' if file_path else None,
        'platform': item.get('platform') or 'link',
        'embedUrl': _youtube_embed(url),
        'uploadedBy': item.get('uploaded_by') or '',
        'uploaderId': item.get('uploader_id'),
        'createdAt': item.get('created_at'),
    }


@app.route('/api/clips', methods=['GET'])
@login_required
def get_clips():
    return jsonify({'clips': [_row_clip(c) for c in list_clips()]})


@app.route('/api/clips', methods=['POST'])
@login_required
def post_clip():
    user = request.current_user
    title = (request.form.get('title') or '').strip()
    url = (request.form.get('url') or '').strip()
    upload = request.files.get('file')
    file_path = ''
    platform = 'link'

    if upload and upload.filename:
        # size check after save is simpler; reject extension first
        original_name = upload.filename.lower()
        ext = Path(original_name).suffix.lower()
        allowed = ALLOWED_VIDEO_EXT | ALLOWED_IMAGE_EXT
        filename, err = save_upload(upload, allowed)
        if err:
            return jsonify({'error': err}), 400
        saved = UPLOAD_DIR / filename
        is_image = ext in ALLOWED_IMAGE_EXT or Path(filename).suffix.lower() in ALLOWED_IMAGE_EXT
        max_mb = 25 if is_image else MAX_CLIP_UPLOAD_MB
        try:
            if saved.stat().st_size > max_mb * 1024 * 1024:
                saved.unlink(missing_ok=True)
                kind = 'Image' if is_image else 'Video'
                return jsonify({'error': f'{kind} must be under {max_mb}MB'}), 400
        except OSError:
            pass
        file_path = filename
        platform = 'image' if is_image else 'upload'
    elif url:
        if not (url.startswith('http://') or url.startswith('https://')):
            return jsonify({'error': 'Clip URL must start with http:// or https://'}), 400
        if len(url) > 500:
            return jsonify({'error': 'URL is too long'}), 400
        platform = _detect_clip_platform(url)
    else:
        return jsonify({'error': 'Add a clip link or upload a photo/video'}), 400

    if len(title) > 120:
        title = title[:120]
    if not title:
        title = 'MAGNOM Clip' if platform != 'image' else 'MAGNOM Photo'

    clip = create_clip(title, url if not file_path else '', file_path, platform, user['username'], user['id'])
    _activity('clip', f'New clip: {title}', platform, user['username'], user['id'], clip['id'])
    return jsonify({'clip': _row_clip(clip)}), 201


@app.route('/api/clips/<int:clip_id>', methods=['DELETE'])
@login_required
def remove_clip(clip_id):
    user = request.current_user
    clip = find_clip_by_id(clip_id)
    if not clip:
        return jsonify({'error': 'Clip not found'}), 404
    owner_id = clip['uploader_id'] if 'uploader_id' in clip.keys() else None
    if owner_id != user['id'] and not is_admin(user):
        return jsonify({'error': 'Only the uploader or an admin can delete this clip'}), 403
    delete_clip(clip_id)
    _activity('clip', 'Clip removed', clip['title'] or '', user['username'], user['id'], clip_id)
    return jsonify({'message': 'Clip deleted'})


@app.route('/api/support-queue', methods=['GET'])
@login_required
def get_support_queue_state():
    user = request.current_user
    mine = get_user_active_support_entry(user['id'])
    payload = {
        'mine': _row_support_queue(mine) if mine else None,
        'waitingCount': count_waiting_support_queue(),
    }
    if is_admin(user):
        payload['waiting'] = [_row_support_queue(r) for r in list_waiting_support_queue()]
        payload['active'] = [_row_support_queue(r) for r in list_active_support_queue()]
    return jsonify(payload)


@app.route('/api/support-queue/join', methods=['POST'])
@login_required
def support_queue_join():
    data = request.get_json(silent=True) or {}
    note = (data.get('note') or '').strip()
    user = request.current_user
    existing = get_user_active_support_entry(user['id'])
    if existing:
        return jsonify({'entry': _row_support_queue(existing), 'message': 'Already in queue'})
    entry_id = join_support_queue(user['id'], user['username'], note)
    entry = get_support_queue_entry(entry_id)
    _activity(
        'support',
        f'{user["username"]} is waiting for admin help',
        note[:120] if note else 'Support call requested',
        user['username'],
        user['id'],
        entry_id,
    )
    return jsonify({'entry': _row_support_queue(entry), 'message': 'Joined queue'})


@app.route('/api/support-queue/leave', methods=['POST'])
@login_required
def support_queue_leave():
    user = request.current_user
    entry = get_user_active_support_entry(user['id'])
    if not entry:
        return jsonify({'message': 'Not in queue'})
    leave_support_queue(user['id'])
    if entry['status'] == 'waiting':
        _activity(
            'support',
            f'{user["username"]} left the support queue',
            '',
            user['username'],
            user['id'],
            entry['id'],
        )
    return jsonify({'message': 'Left queue'})


@app.route('/api/support-queue/claim/<int:entry_id>', methods=['POST'])
@admin_required
def support_queue_claim(entry_id):
    admin = request.current_user
    entry = get_support_queue_entry(entry_id)
    if not entry or entry['status'] != 'waiting':
        return jsonify({'error': 'Not available'}), 404
    if not claim_support_queue_entry(entry_id, admin['id'], admin['username']):
        return jsonify({'error': 'Could not claim'}), 409
    entry = get_support_queue_entry(entry_id)
    _activity(
        'support',
        f'Admin {admin["username"]} answered {entry["username"]}',
        'Support call started — check Admin Support',
        admin['username'],
        admin['id'],
        entry_id,
    )
    return jsonify({'entry': _row_support_queue(entry), 'message': 'Call claimed'})


@app.route('/api/support-queue/complete/<int:entry_id>', methods=['POST'])
@login_required
def support_queue_complete(entry_id):
    user = request.current_user
    entry = get_support_queue_entry(entry_id)
    if not entry or entry['status'] not in ('waiting', 'active'):
        return jsonify({'error': 'Not found'}), 404
    if not is_admin(user) and entry['user_id'] != user['id']:
        return jsonify({'error': 'Forbidden'}), 403
    if not is_admin(user) and entry['status'] != 'active':
        return jsonify({'error': 'Use leave queue while waiting'}), 400
    if not complete_support_queue_entry(entry_id):
        return jsonify({'error': 'Could not complete'}), 409
    _activity(
        'support',
        f'Support call ended: {entry["username"]}',
        '',
        user['username'],
        user['id'],
        entry_id,
    )
    return jsonify({'message': 'Call ended'})


def _can_access_support_call(entry, user):
    if not entry or entry['status'] != 'active':
        return False
    if entry['user_id'] == user['id']:
        return True
    if entry['admin_id'] == user['id']:
        return True
    return False


@app.route('/api/support-queue/<int:entry_id>/signals', methods=['GET'])
@login_required
def get_support_call_signals(entry_id):
    user = request.current_user
    entry = get_support_queue_entry(entry_id)
    if not _can_access_support_call(entry, user):
        return jsonify({'error': 'Forbidden'}), 403
    after_id = request.args.get('after', 0, type=int)
    rows = list_support_call_signals(entry_id, after_id, user['id'])
    signals = []
    for row in rows:
        try:
            payload = json.loads(row['payload'])
        except json.JSONDecodeError:
            continue
        signals.append({
            'id': row['id'],
            'type': row['signal_type'],
            'payload': payload,
            'fromUserId': row['from_user_id'],
        })
    latest_id = max((s['id'] for s in signals), default=after_id)
    return jsonify({'signals': signals, 'latestId': latest_id})


@app.route('/api/support-queue/<int:entry_id>/signals', methods=['POST'])
@login_required
def post_support_call_signal_route(entry_id):
    user = request.current_user
    entry = get_support_queue_entry(entry_id)
    if not _can_access_support_call(entry, user):
        return jsonify({'error': 'Forbidden'}), 403
    data = request.get_json(silent=True) or {}
    signal_type = (data.get('type') or '').strip()
    payload = data.get('payload')
    if signal_type not in ('offer', 'answer', 'ice') or payload is None:
        return jsonify({'error': 'Invalid signal'}), 400
    try:
        payload_text = json.dumps(payload)
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid payload'}), 400
    if len(payload_text) > 50000:
        return jsonify({'error': 'Payload too large'}), 400
    signal_id = post_support_call_signal(entry_id, user['id'], signal_type, payload_text)
    return jsonify({'id': signal_id})


def _row_support_queue(row):
    if row is None:
        return None
    position = support_queue_position(row['id']) if row['status'] == 'waiting' else 0
    return {
        'id': row['id'],
        'userId': row['user_id'],
        'username': row['username'],
        'note': row['note'],
        'status': row['status'],
        'adminId': row['admin_id'],
        'adminUsername': row['admin_username'],
        'position': position,
        'createdAt': row['created_at'],
        'claimedAt': row['claimed_at'],
        'endedAt': row['ended_at'],
    }


@app.route('/api/activity', methods=['GET'])
@login_required
def get_activity():
    after_id = request.args.get('after', 0, type=int)
    recent = request.args.get('recent') == '1'
    if recent:
        rows = list_recent_activities(50)
    else:
        rows, _ = list_activities(after_id, limit=50)
    with get_connection() as conn:
        latest_id = conn.execute('SELECT COALESCE(MAX(id), 0) as m FROM activity_log').fetchone()['m']
    return jsonify({
        'activities': [_row_activity(r) for r in rows],
        'latestId': latest_id,
    })


@app.route('/api/push/vapid-public-key', methods=['GET'])
def push_vapid_public_key():
    try:
        return jsonify({'publicKey': get_vapid_public_key()})
    except Exception:
        return jsonify({'error': 'Push not configured'}), 503


@app.route('/api/push/subscribe', methods=['POST'])
@login_required
def push_subscribe():
    data = request.get_json(silent=True) or {}
    endpoint = (data.get('endpoint') or '').strip()
    keys = data.get('keys') or {}
    p256dh = (keys.get('p256dh') or '').strip()
    auth = (keys.get('auth') or '').strip()
    if not endpoint or not p256dh or not auth:
        return jsonify({'error': 'Invalid subscription'}), 400
    upsert_push_subscription(
        request.current_user['id'],
        endpoint,
        p256dh,
        auth,
        (request.headers.get('User-Agent') or '')[:500],
    )
    return jsonify({'message': 'Subscribed'})


@app.route('/api/push/unsubscribe', methods=['POST'])
@login_required
def push_unsubscribe():
    data = request.get_json(silent=True) or {}
    endpoint = (data.get('endpoint') or '').strip()
    if endpoint:
        delete_push_subscription(endpoint)
    return jsonify({'message': 'Unsubscribed'})


@app.route('/media/<path:filename>')
def public_media(filename):
    safe_name = Path(filename).name
    file_path = UPLOAD_DIR / safe_name
    if not file_path.is_file():
        return jsonify({'error': 'File not found'}), 404
    ext = file_path.suffix.lower()
    mimetype = f'image/{ext[1:].replace("jpg", "jpeg")}' if ext in ALLOWED_IMAGE_EXT else 'application/octet-stream'
    return send_from_directory(UPLOAD_DIR, safe_name, mimetype=mimetype, conditional=True)


@app.route('/uploads/<path:filename>')
@login_required
def uploaded_file(filename):
    user = request.current_user
    if user['status'] != 'approved':
        return jsonify({'error': 'Forbidden'}), 403
    safe_name = Path(filename).name
    file_path = UPLOAD_DIR / safe_name
    if not file_path.is_file():
        return jsonify({'error': 'File not found'}), 404

    ext = file_path.suffix.lower()
    mimetype = AUDIO_MIME.get(ext)
    if not mimetype:
        if ext in ALLOWED_IMAGE_EXT:
            mimetype = f'image/{ext[1:].replace("jpg", "jpeg")}'
        elif ext in ALLOWED_VIDEO_EXT:
            mimetype = {
                '.mp4': 'video/mp4',
                '.webm': 'video/webm',
                '.mov': 'video/quicktime',
                '.m4v': 'video/x-m4v',
            }.get(ext, 'video/mp4')
        else:
            mimetype = 'application/octet-stream'

    response = send_from_directory(UPLOAD_DIR, safe_name, mimetype=mimetype, conditional=True)
    response.headers['Accept-Ranges'] = 'bytes'
    response.headers['Cache-Control'] = 'private, max-age=3600'
    return response


@app.route('/api/ai/status', methods=['GET'])
def ai_status():
    return jsonify({
        'service': 'MAGNOM AI',
        'status': 'online',
        'chatEndpoint': '/api/ai/chat',
    })


@app.route('/magnom-logo.png')
def magnom_logo():
    return send_from_directory('.', 'magnom-logo.png')


@app.route('/ai')
@app.route('/ai/')
def magnom_ai_app():
    return send_from_directory('.', 'magnom-ai-app.html')


@app.route('/ai/status')
def magnom_ai_status_page():
    return send_from_directory('.', 'magnom-ai.html')


@app.route('/')
def index():
    return send_from_directory('.', 'index.html')


init_db()
seed_bootstrap_admin()
_seed_result = seed_clan_roster_from_file(force=False)
if _seed_result.get('added'):
    print(f"Seeded clan roster: +{_seed_result['added']} (total {_seed_result.get('total')})")

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3000))
    print(f'Magnom Clan Dashboard running at http://localhost:{port}')
    app.run(host='0.0.0.0', port=port, debug=False)
