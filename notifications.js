/* MAGNOM Clan — Live activity notifications (broadcast to all logged-in users) */

let lastPollId = 0;
let lastReadId = 0;
let activityPollInterval = null;
let activityFeedCache = [];
let activityPanelOpen = false;
let activityPollReady = false;

const ACTIVITY_POLL_MS = 3000;

const ACTIVITY_ICONS = {
    chat: '💬',
    news: '📰',
    event: '📅',
    gallery: '🖼️',
    member: '👥',
    signup: '📝',
    training: '🏋️',
    roster: '👑',
    account: '⚙️',
    support: '📞',
};

const ACTIVITY_SECTIONS = {
    chat: 'chat',
    news: 'news',
    event: 'events',
    gallery: 'gallery',
    member: 'roster',
    signup: 'roster',
    training: 'chat',
    roster: 'roster',
    account: 'home',
    support: 'support',
};

async function activityApi(path) {
    if (typeof api === 'function') return api(path);
    const res = await fetch(path, { credentials: 'include', headers: { Accept: 'application/json' } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
}

function activityIcon(kind) {
    return ACTIVITY_ICONS[kind] || '🔔';
}

function formatActivityTime(iso) {
    if (!iso) return '';
    try {
        const d = typeof parseDbDate === 'function' ? parseDbDate(iso) : new Date(iso.replace(' ', 'T'));
        if (!d) return '';
        const now = new Date();
        const diff = (now - d) / 1000;
        if (diff < 60) return typeof t === 'function' ? t('notify.timeNow') : 'Just now';
        if (diff < 3600) {
            const m = Math.floor(diff / 60);
            return typeof t === 'function' ? t('notify.timeMinutes').replace('{n}', m) : `${m}m`;
        }
        if (diff < 86400) {
            const h = Math.floor(diff / 3600);
            return typeof t === 'function' ? t('notify.timeHours').replace('{n}', h) : `${h}h`;
        }
        return d.toLocaleDateString(typeof getLang === 'function' && getLang() === 'ar' ? 'ar' : undefined,
            { month: 'short', day: 'numeric' });
    } catch { return ''; }
}

function syncReadState() {
    const maxId = activityFeedCache.reduce((m, a) => Math.max(m, a.id), 0);
    if (lastReadId > maxId) {
        lastReadId = maxId;
        sessionStorage.setItem('magnom_notif_read', String(lastReadId));
    }
}

function updateNotificationBadge() {
    const badge = document.getElementById('notifBadge');
    if (!badge) return;
    const count = activityFeedCache.filter(a => a.id > lastReadId).length;
    if (count > 0 && !activityPanelOpen) {
        badge.textContent = count > 99 ? '99+' : String(count);
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

function renderActivityPanel() {
    const list = document.getElementById('notifList');
    if (!list) return;
    if (!activityFeedCache.length) {
        list.innerHTML = `<p class="notif-empty">${typeof t === 'function' ? t('notify.empty') : 'No notifications yet'}</p>`;
        return;
    }
    list.innerHTML = activityFeedCache.slice(0, 50).map(a => `
        <button type="button" class="notif-item ${a.id > lastReadId ? 'unread' : ''}" data-kind="${escapeHtml(a.kind)}" onclick="handleActivityClick(${a.id})">
            <span class="notif-item-icon">${activityIcon(a.kind)}</span>
            <span class="notif-item-body">
                <strong>${escapeHtml(a.title)}</strong>
                ${a.body ? `<span>${escapeHtml(a.body.slice(0, 100))}${a.body.length > 100 ? '…' : ''}</span>` : ''}
                <em>${formatActivityTime(a.createdAt)}${a.actor ? ' · ' + escapeHtml(a.actor) : ''}</em>
            </span>
        </button>
    `).join('');
}

function handleActivityClick(id) {
    const item = activityFeedCache.find(a => a.id === id);
    if (!item) return;
    markActivitiesSeenUpTo(id);
    toggleNotificationPanel(false);
    const section = ACTIVITY_SECTIONS[item.kind];
    if (section && typeof navigateSiteSection === 'function') {
        navigateSiteSection(section);
    }
}

function markAllActivitiesRead() {
    const maxId = activityFeedCache.reduce((m, a) => Math.max(m, a.id), 0);
    markActivitiesSeenUpTo(maxId);
}

function markActivitiesSeenUpTo(id) {
    lastReadId = Math.max(lastReadId, id || 0);
    sessionStorage.setItem('magnom_notif_read', String(lastReadId));
    updateNotificationBadge();
    renderActivityPanel();
}

function toggleNotificationPanel(force) {
    const panel = document.getElementById('notifPanel');
    const btn = document.getElementById('notifBellBtn');
    if (!panel) return;
    const open = force !== undefined ? force : !activityPanelOpen;
    activityPanelOpen = open;
    panel.classList.toggle('open', open);
    btn?.classList.toggle('active', open);
    if (open) renderActivityPanel();
}

function shouldToastActivity(item) {
    if (!activityPollReady) return false;
    if (item.kind === 'chat' && typeof currentSiteSection !== 'undefined' && currentSiteSection === 'chat') {
        return false;
    }
    return true;
}

function showActivityToast(item) {
    const title = item.title || (typeof t === 'function' ? t('notify.siteUpdate') : 'Site update');
    const detail = item.body ? ` — ${item.body.slice(0, 60)}${item.body.length > 60 ? '…' : ''}` : '';
    const msg = `${activityIcon(item.kind)} ${title}${detail}`;
    if (typeof notify === 'function') notify(msg, false);
}

function isOnSection(section) {
    return typeof currentSiteSection !== 'undefined' && currentSiteSection === section;
}

function refreshForActivity(item) {
    if (item.kind === 'news' && (isOnSection('home') || isOnSection('news'))) {
        if (typeof bustFetchCache === 'function') bustFetchCache('/api/announcements');
        if (isOnSection('home') && typeof loadHomeSection === 'function') loadHomeSection();
        if (isOnSection('news') && typeof loadNewsSection === 'function') loadNewsSection(true);
    }
    if (item.kind === 'event' && (isOnSection('home') || isOnSection('events'))) {
        if (typeof bustFetchCache === 'function') bustFetchCache('/api/events');
        if (isOnSection('home') && typeof loadHomeSection === 'function') loadHomeSection();
        if (isOnSection('events') && typeof loadEventsSection === 'function') loadEventsSection(true);
    }
    if ((item.kind === 'member' || item.kind === 'roster' || item.kind === 'signup')
        && (isOnSection('roster') || isOnSection('home') || isOnSection('leaderboard'))) {
        if (typeof loadMembers === 'function') {
            loadMembers().then(() => {
                if (typeof renderAll === 'function') renderAll();
            });
        }
    }
    if ((item.kind === 'chat' || item.kind === 'training') && isOnSection('chat')) {
        if (item.title && /removed|deleted/i.test(item.title) && typeof reloadChatFromScratch === 'function') {
            reloadChatFromScratch();
        } else if (typeof loadChatMessages === 'function') {
            loadChatMessages(false);
        }
    }
    if (item.kind === 'gallery' && isOnSection('gallery')) {
        if (typeof bustFetchCache === 'function') bustFetchCache('/api/gallery');
        if (typeof loadGallerySection === 'function') loadGallerySection(true);
    }
    if (item.kind === 'support' && (isOnSection('support') || typeof isAdmin === 'function' && isAdmin())) {
        if (typeof refreshSupportQueue === 'function') refreshSupportQueue();
    }
}

function pushActivityToFeed(item, showToast) {
    if (activityFeedCache.some(a => a.id === item.id)) return;
    activityFeedCache.unshift(item);
    activityFeedCache.sort((a, b) => b.id - a.id);
    activityFeedCache = activityFeedCache.slice(0, 80);
    updateNotificationBadge();
    if (activityPanelOpen) renderActivityPanel();
    refreshForActivity(item);
    if (showToast && shouldToastActivity(item)) {
        showActivityToast(item);
    }
    document.dispatchEvent(new CustomEvent('activity', { detail: item }));
}

async function pollActivity() {
    if (typeof currentUser === 'undefined' || !currentUser) return;
    try {
        const data = await activityApi(`/api/activity?after=${lastPollId}`);
        const items = data.activities || [];
        items.forEach(item => {
            pushActivityToFeed(item, activityPollReady);
            lastPollId = Math.max(lastPollId, item.id);
        });
        if (data.latestId != null) {
            lastPollId = Math.max(lastPollId, data.latestId);
        }
        updateNotificationBadge();
    } catch { /* logged out or offline */ }
}

async function loadRecentActivity() {
    if (typeof currentUser === 'undefined' || !currentUser) return;
    try {
        const data = await activityApi('/api/activity?recent=1');
        activityFeedCache = (data.activities || []).map(a => ({ ...a }));
        activityFeedCache.sort((a, b) => b.id - a.id);
        lastPollId = data.latestId || 0;
        lastReadId = parseInt(sessionStorage.getItem('magnom_notif_read') || '0', 10);
        syncReadState();
        updateNotificationBadge();
        if (activityPanelOpen) renderActivityPanel();
    } catch { /* ignore */ }
}

function startActivityPoll() {
    if (activityPollInterval) {
        clearInterval(activityPollInterval);
        activityPollInterval = null;
    }
    activityPollReady = false;
    loadRecentActivity().then(() => {
        activityPollReady = true;
        pollActivity();
        activityPollInterval = setInterval(pollActivity, ACTIVITY_POLL_MS);
    });
}

function stopActivityPoll() {
    if (activityPollInterval) {
        clearInterval(activityPollInterval);
        activityPollInterval = null;
    }
    activityPanelOpen = false;
    activityPollReady = false;
    activityFeedCache = [];
    lastPollId = 0;
    document.getElementById('notifPanel')?.classList.remove('open');
    document.getElementById('notifBadge')?.style.setProperty('display', 'none');
}

document.addEventListener('click', (e) => {
    const wrap = document.getElementById('notifWrap');
    if (wrap && activityPanelOpen && !wrap.contains(e.target)) {
        toggleNotificationPanel(false);
    }
});

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && typeof currentUser !== 'undefined' && currentUser) {
        pollActivity();
    }
});
