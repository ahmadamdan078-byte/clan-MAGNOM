/* MAGNOM Clan — Site navigation & content */

let currentSiteSection = 'home';
let siteDataCache = { announcements: [], events: [], gallery: [] };

const _fetchCache = new Map();
const CACHE_TTL_MS = 45000;

async function fetchCachedJson(url, ttl = CACHE_TTL_MS) {
    const now = Date.now();
    const hit = _fetchCache.get(url);
    if (hit && now - hit.at < ttl) return hit.data;
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    _fetchCache.set(url, { data, at: now });
    return data;
}

function bustFetchCache(prefix) {
    for (const key of _fetchCache.keys()) {
        if (key.startsWith(prefix)) _fetchCache.delete(key);
    }
}

function onDashboardReady() {
    document.getElementById('landingPage')?.classList.remove('active');
    document.getElementById('siteNav')?.classList.add('visible');
    document.getElementById('livePulse')?.style.setProperty('display', 'inline-flex');
    document.body.classList.remove('auth-overlay-mode');
    document.getElementById('authContainer').style.display = 'none';
    updateSiteAdminForms();
    navigateSiteSection('home');
    if (typeof initWebPush === 'function') initWebPush();
}

function showLanding() {
    document.getElementById('landingPage')?.classList.add('active');
    document.getElementById('authContainer').style.display = 'none';
    document.getElementById('dashboardContainer')?.classList.remove('active');
    document.body.classList.remove('dashboard-open');
    document.getElementById('siteNav')?.classList.remove('visible');
    document.getElementById('livePulse')?.style.setProperty('display', 'none');
    document.body.classList.remove('auth-overlay-mode');
    loadLandingData();
    initScrollReveal();
}

function openAuthOverlay(tab) {
    document.body.classList.add('auth-overlay-mode');
    document.getElementById('authContainer').style.display = 'flex';
    if (tab) switchAuthTab(tab);
    document.getElementById('loginUsername')?.focus();
}

function closeAuthOverlay() {
    document.body.classList.remove('auth-overlay-mode');
    if (!currentUser) {
        document.getElementById('authContainer').style.display = 'none';
    }
}

async function loadLandingData() {
    try {
        const [stats, news, events, gallery] = await Promise.all([
            fetchCachedJson('/api/site/stats', 60000),
            fetchCachedJson('/api/announcements'),
            fetchCachedJson('/api/events?upcoming=1'),
            fetchCachedJson('/api/gallery'),
        ]);
        siteDataCache.announcements = news.announcements || [];
        siteDataCache.events = events.events || [];
        siteDataCache.gallery = gallery.items || [];

        const animateStatCounter = (id, target) => {
            const el = document.getElementById(id);
            if (!el) return;
            const end = Number(target) || 0;
            const duration = 900;
            const start = performance.now();
            const tick = (now) => {
                const p = Math.min((now - start) / duration, 1);
                el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
                if (p < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        };
        animateStatCounter('landingStatMembers', stats.members ?? 0);
        animateStatCounter('landingStatUsers', stats.users ?? 0);
        animateStatCounter('landingStatCoaches', stats.coaches ?? 0);
        animateStatCounter('landingStatEvents', stats.upcomingEvents ?? 0);

        renderAnnouncementTicker(siteDataCache.announcements);

        renderLandingNews(siteDataCache.announcements.slice(0, 3));
        renderLandingEvents(siteDataCache.events.slice(0, 3));
        renderLandingGallery(siteDataCache.gallery.slice(0, 6));
    } catch (e) {
        console.warn('Landing data load failed', e);
    }
}

function tx(key) {
    return typeof t === 'function' ? t(key) : key;
}

function renderLandingNews(items) {
    const el = document.getElementById('landingNewsGrid');
    if (!el) return;
    if (!items.length) {
        el.innerHTML = `<p class="card-meta" style="text-align:center;grid-column:1/-1">${escapeHtml(tx('empty.news'))}</p>`;
        return;
    }
    el.innerHTML = items.map(a => `
        <article class="news-card ${a.pinned ? 'pinned' : ''}">
            ${a.pinned ? `<span class="event-date-badge">${escapeHtml(tx('pinned'))}</span>` : ''}
            <h4>${escapeHtml(a.title)}</h4>
            <p>${escapeHtml(a.body)}</p>
            <div class="card-meta">${escapeHtml(a.author)} · ${formatSiteDate(a.createdAt)}</div>
        </article>
    `).join('');
}

function renderLandingEvents(items) {
    const el = document.getElementById('landingEventsGrid');
    if (!el) return;
    if (!items.length) {
        el.innerHTML = `<p class="card-meta" style="text-align:center;grid-column:1/-1">${escapeHtml(tx('empty.events'))}</p>`;
        return;
    }
    el.innerHTML = items.map(e => `
        <article class="event-card">
            <span class="event-date-badge">📅 ${escapeHtml(e.eventDate)}${e.eventTime ? ' · ' + escapeHtml(e.eventTime) : ''}</span>
            <h4>${escapeHtml(e.title)}</h4>
            <p>${escapeHtml(e.description || '')}</p>
            <div class="card-meta">${escapeHtml(e.createdBy)}</div>
        </article>
    `).join('');
}

function renderLandingGallery(items) {
    const el = document.getElementById('landingGalleryGrid');
    if (!el) return;
    if (!items.length) {
        el.innerHTML = `<p class="card-meta" style="text-align:center;grid-column:1/-1">${escapeHtml(tx('empty.gallery'))}</p>`;
        return;
    }
    el.innerHTML = items.map(g => `
        <figure class="gallery-item">
            <img src="${escapeHtml(g.imageUrl)}" alt="${escapeHtml(g.caption || 'Clan photo')}" loading="lazy">
            ${g.caption ? `<figcaption>${escapeHtml(g.caption)}</figcaption>` : ''}
        </figure>
    `).join('');
}

function formatSiteDate(iso) {
    if (!iso) return '';
    try {
        const d = typeof parseDbDate === 'function' ? parseDbDate(iso) : new Date(iso.replace(' ', 'T'));
        if (!d) return iso;
        return d.toLocaleDateString(typeof getLang === 'function' && getLang() === 'ar' ? 'ar' : undefined, {
            month: 'short', day: 'numeric', year: 'numeric'
        });
    } catch { return iso; }
}

function navigateSiteSection(section) {
    currentSiteSection = section;
    document.querySelectorAll('.site-section').forEach(s => {
        s.classList.toggle('active', s.dataset.section === section);
    });
    document.querySelectorAll('.site-nav-link').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.section === section);
    });

    if (section === 'news') loadNewsSection();
    if (section === 'events') loadEventsSection();
    if (section === 'gallery') loadGallerySection();
    if (section === 'leaderboard') renderLeaderboard();
    if (section === 'roster') renderAll();
    if (section === 'home') loadHomeSection();
    if (section === 'chat' && typeof loadChatMessages === 'function') loadChatMessages(false);
    if (section === 'support' && typeof loadSupportSection === 'function') loadSupportSection();

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function canManageEvents() {
    return (typeof isAdmin === 'function' && isAdmin())
        || (typeof isCoachRole === 'function' && isCoachRole());
}

function eventDeleteButton(eventId) {
    if (!canManageEvents()) return '';
    return `<button type="button" class="btn-danger btn-sm" style="margin-top:10px" onclick="deleteEvent(${eventId})">${escapeHtml(tx('delete'))}</button>`;
}

async function loadHomeSection() {
    try {
        const [news, events] = await Promise.all([
            fetchCachedJson('/api/announcements'),
            fetchCachedJson('/api/events?upcoming=1'),
        ]);
        renderHomeWelcome();
        const el = document.getElementById('homeNewsPreview');
        const ev = document.getElementById('homeEventsPreview');
        if (el) {
            const items = (news.announcements || []).slice(0, 2);
            el.innerHTML = items.length ? items.map(a => `
                <div class="news-card ${a.pinned ? 'pinned' : ''}" style="margin-bottom:12px">
                    <h4>${escapeHtml(a.title)}</h4>
                    <p>${escapeHtml(a.body.slice(0, 120))}${a.body.length > 120 ? '…' : ''}</p>
                </div>
            `).join('') : `<p class="card-meta">${escapeHtml(tx('empty.news'))}</p>`;
        }
        if (ev) {
            const items = (events.events || []).slice(0, 2);
            ev.innerHTML = items.length ? items.map(e => `
                <div class="event-card" style="margin-bottom:12px">
                    <span class="event-date-badge">${escapeHtml(e.eventDate)}</span>
                    <h4>${escapeHtml(e.title)}</h4>
                    ${eventDeleteButton(e.id)}
                </div>
            `).join('') : `<p class="card-meta">${escapeHtml(tx('empty.events'))}</p>`;
        }
    } catch { /* ignore */ }
}

async function loadNewsSection(force = false) {
    try {
        if (force) bustFetchCache('/api/announcements');
        const data = await fetchCachedJson('/api/announcements');
        siteDataCache.announcements = data.announcements || [];
        const el = document.getElementById('newsList');
        if (!el) return;
        el.innerHTML = siteDataCache.announcements.length ? siteDataCache.announcements.map(a => `
            <article class="news-card ${a.pinned ? 'pinned' : ''}" style="margin-bottom:14px">
                ${a.pinned ? `<span class="event-date-badge">${escapeHtml(tx('pinned'))}</span>` : ''}
                <h4>${escapeHtml(a.title)}</h4>
                <p>${escapeHtml(a.body)}</p>
                <div class="card-meta">${escapeHtml(a.author)} · ${formatSiteDate(a.createdAt)}</div>
                ${typeof isAdmin === 'function' && isAdmin() ? `<button class="btn-danger btn-sm" style="margin-top:10px" onclick="deleteAnnouncement(${a.id})">${escapeHtml(tx('delete'))}</button>` : ''}
            </article>
        `).join('') : `<div class="empty-state"><p>${escapeHtml(tx('empty.newsSection'))}</p></div>`;
    } catch { /* ignore */ }
}

async function loadEventsSection(force = false) {
    try {
        if (force) bustFetchCache('/api/events');
        const data = await fetchCachedJson('/api/events');
        siteDataCache.events = data.events || [];
        const el = document.getElementById('eventsList');
        if (!el) return;
        el.innerHTML = siteDataCache.events.length ? siteDataCache.events.map(e => `
            <article class="event-card" style="margin-bottom:14px">
                <span class="event-date-badge">📅 ${escapeHtml(e.eventDate)}${e.eventTime ? ' · ' + escapeHtml(e.eventTime) : ''}</span>
                <h4>${escapeHtml(e.title)}</h4>
                <p>${escapeHtml(e.description || '')}</p>
                <div class="card-meta">${escapeHtml(e.createdBy)}</div>
                ${eventDeleteButton(e.id)}
            </article>
        `).join('') : `<div class="empty-state"><p>${escapeHtml(tx('empty.eventsSection'))}</p></div>`;
    } catch { /* ignore */ }
}

async function loadGallerySection(force = false) {
    try {
        if (force) bustFetchCache('/api/gallery');
        const data = await fetchCachedJson('/api/gallery');
        siteDataCache.gallery = data.items || [];
        const el = document.getElementById('galleryGrid');
        if (!el) return;
        el.innerHTML = siteDataCache.gallery.length ? siteDataCache.gallery.map(g => `
            <figure class="gallery-item">
                <img src="${escapeHtml(g.imageUrl)}" alt="${escapeHtml(g.caption || '')}" loading="lazy">
                ${g.caption ? `<figcaption>${escapeHtml(g.caption)}</figcaption>` : ''}
                ${typeof isAdmin === 'function' && isAdmin() ? `<button class="btn-danger btn-sm" style="position:absolute;top:8px;right:8px" onclick="event.stopPropagation();deleteGalleryItem(${g.id})">✕</button>` : ''}
            </figure>
        `).join('') : `<div class="empty-state" style="grid-column:1/-1"><p>${escapeHtml(tx('empty.gallerySection'))}</p></div>`;
    } catch { /* ignore */ }
}

function renderLeaderboard() {
    const el = document.getElementById('leaderboardContent');
    if (!el || typeof members === 'undefined') return;
    const sorted = [...members].sort((a, b) => {
        const rankDiff = (RANK_ORDER[b.rank] || 0) - (RANK_ORDER[a.rank] || 0);
        if (rankDiff !== 0) return rankDiff;
        return b.level - a.level;
    });
    if (!sorted.length) {
        el.innerHTML = `<div class="empty-state"><p>${escapeHtml(tx('empty.leaderboard'))}</p></div>`;
        return;
    }
    const top3 = sorted.slice(0, 3);
    const medals = ['🥇', '🥈', '🥉'];
    const classes = ['first', 'second', 'third'];
    let podium = '<div class="leaderboard-podium">';
    top3.forEach((m, i) => {
        podium += `
            <div class="podium-slot ${classes[i]}">
                <div class="podium-rank">${medals[i]}</div>
                <div class="podium-name">${escapeHtml(m.name)}</div>
                <div class="podium-detail">${escapeHtml(m.rank)} · Lv ${m.level}</div>
            </div>`;
    });
    podium += '</div>';
    const rest = sorted.slice(3).map((m, i) => `
        <div class="member-card ${typeof rankClass === 'function' ? rankClass(m.rank) : ''}" style="margin-bottom:12px">
            <div class="member-card-main">
                <div class="member-info">
                    <div class="member-name">#${i + 4} ${escapeHtml(m.name)}</div>
                    <div class="member-level">Level ${m.level} · ${escapeHtml(m.rank)}</div>
                </div>
            </div>
        </div>
    `).join('');
    el.innerHTML = podium + (rest ? `<div>${rest}</div>` : '');
}

async function postAnnouncement(e) {
    e.preventDefault();
    if (!isAdmin()) return;
    const title = document.getElementById('newsTitle').value.trim();
    const body = document.getElementById('newsBody').value.trim();
    const pinned = document.getElementById('newsPinned').checked;
    try {
        await api('/api/announcements', {
            method: 'POST',
            body: JSON.stringify({ title, body, pinned }),
        });
        document.getElementById('newsForm').reset();
        bustFetchCache('/api/announcements');
        notify(tx('notify.newsPosted'));
        loadNewsSection(true);
        loadHomeSection();
    } catch (err) {
        notify(err.message, true);
    }
}

async function deleteAnnouncement(id) {
    if (!confirm(tx('delete.newsConfirm'))) return;
    try {
        await api(`/api/announcements/${id}`, { method: 'DELETE' });
        bustFetchCache('/api/announcements');
        notify(tx('notify.newsDeleted'));
        loadNewsSection(true);
    } catch (err) {
        notify(err.message, true);
    }
}

async function postEvent(e) {
    e.preventDefault();
    if (!isAdmin() && !isCoachRole()) return;
    const title = document.getElementById('eventTitle').value.trim();
    const description = document.getElementById('eventDescription').value.trim();
    const eventDate = document.getElementById('eventDate').value;
    const eventTime = document.getElementById('eventTime').value;
    try {
        await api('/api/events', {
            method: 'POST',
            body: JSON.stringify({ title, description, eventDate, eventTime }),
        });
        document.getElementById('eventForm').reset();
        bustFetchCache('/api/events');
        notify(tx('notify.eventCreated'));
        loadEventsSection(true);
        loadHomeSection();
    } catch (err) {
        notify(err.message, true);
    }
}

async function deleteEvent(id) {
    if (!canManageEvents()) return;
    if (!confirm(tx('delete.eventConfirm'))) return;
    try {
        await api(`/api/events/${id}`, { method: 'DELETE' });
        bustFetchCache('/api/events');
        notify(tx('notify.eventDeleted'));
        loadEventsSection(true);
        loadHomeSection();
        if (typeof loadLandingData === 'function') loadLandingData();
    } catch (err) {
        notify(err.message, true);
    }
}

async function postGallery(e) {
    e.preventDefault();
    if (!isAdmin()) return;
    const file = document.getElementById('galleryFile').files[0];
    if (!file) { notify(tx('gallery.chooseImage'), true); return; }
    const form = new FormData();
    form.append('caption', document.getElementById('galleryCaption').value.trim());
    form.append('file', file);
    try {
        await api('/api/gallery', { method: 'POST', body: form });
        document.getElementById('galleryForm').reset();
        bustFetchCache('/api/gallery');
        notify(tx('gallery.uploaded'));
        loadGallerySection(true);
    } catch (err) {
        notify(err.message, true);
    }
}

async function deleteGalleryItem(id) {
    if (!confirm(tx('delete.galleryConfirm'))) return;
    try {
        await api(`/api/gallery/${id}`, { method: 'DELETE' });
        bustFetchCache('/api/gallery');
        notify(tx('notify.deleted'));
        loadGallerySection(true);
    } catch (err) {
        notify(err.message, true);
    }
}

function initSiteNav() {
    document.querySelectorAll('.site-nav-link').forEach(btn => {
        btn.addEventListener('click', () => navigateSiteSection(btn.dataset.section));
    });
    document.getElementById('newsForm')?.addEventListener('submit', postAnnouncement);
    document.getElementById('eventForm')?.addEventListener('submit', postEvent);
    document.getElementById('galleryForm')?.addEventListener('submit', postGallery);
}

function updateSiteAdminForms() {
    const admin = typeof isAdmin === 'function' && isAdmin();
    const coach = typeof isCoachRole === 'function' && isCoachRole();
    document.getElementById('newsAdminForm')?.style.setProperty('display', admin ? 'block' : 'none');
    document.getElementById('eventAdminForm')?.style.setProperty('display', (admin || coach) ? 'block' : 'none');
    document.getElementById('galleryAdminForm')?.style.setProperty('display', admin ? 'block' : 'none');
    if (currentSiteSection === 'events') loadEventsSection();
    if (currentSiteSection === 'home') loadHomeSection();
}

document.addEventListener('DOMContentLoaded', () => {
    initSiteNav();
});

function renderAnnouncementTicker(announcements) {
    const ticker = document.getElementById('announcementTicker');
    const text = document.getElementById('tickerText');
    if (!ticker || !text) return;
    const item = (announcements || []).find(a => a.pinned) || (announcements || [])[0];
    if (!item) {
        ticker.style.display = 'none';
        return;
    }
    text.textContent = item.title + (item.body ? ' — ' + item.body.slice(0, 80) : '');
    ticker.style.display = 'flex';
}

function renderMemberSpotlight() {
    const el = document.getElementById('memberSpotlight');
    if (!el || typeof members === 'undefined' || !members.length) {
        if (el) el.style.display = 'none';
        return;
    }
    const sorted = [...members].sort((a, b) => {
        const ro = typeof RANK_ORDER !== 'undefined' ? RANK_ORDER : {};
        const rd = (ro[b.rank] || 0) - (ro[a.rank] || 0);
        return rd !== 0 ? rd : b.level - a.level;
    });
    const top = sorted[0];
    el.style.display = 'flex';
    el.innerHTML = `
        <span class="spotlight-badge">${escapeHtml(tx('spotlight.badge'))}</span>
        <div class="spotlight-info">
            <h3>${escapeHtml(top.name)}</h3>
            <p>${escapeHtml(tx('spotlight.level'))} ${top.level} · ${escapeHtml(typeof formatClanRole === 'function' ? formatClanRole(top.role) : top.role)}</p>
        </div>
        <div class="spotlight-rank">
            <strong>${escapeHtml(top.rank)}</strong>
            <span class="card-meta">${escapeHtml(tx('spotlight.top'))}</span>
        </div>`;
}

function copyShareLink() {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
        if (typeof notify === 'function') notify(tx('notify.linkCopied'));
    }).catch(() => {
        if (typeof notify === 'function') notify('Copy this link: ' + url, false);
    });
}

function hidePageLoader() {
    const hide = () => document.getElementById('pageLoader')?.classList.add('hidden');
    if (document.readyState === 'complete') hide();
    else requestAnimationFrame(hide);
}

function initScrollToTop() {
    const btn = document.getElementById('scrollTopBtn');
    if (!btn) return;
    window.addEventListener('scroll', () => {
        btn.classList.toggle('visible', window.scrollY > 400);
    }, { passive: true });
}

function initScrollReveal() {
    const els = document.querySelectorAll('.feature-card:not(.revealed), .landing-section:not(.revealed), .news-card:not(.revealed), .event-card:not(.revealed)');
    els.forEach(el => el.classList.add('reveal-on-scroll'));
    const obs = new IntersectionObserver((entries) => {
        entries.forEach(e => {
            if (e.isIntersecting) {
                e.target.classList.add('revealed');
                obs.unobserve(e.target);
            }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.reveal-on-scroll:not(.revealed)').forEach(el => obs.observe(el));
}

function renderHomeWelcome() {
    const el = document.getElementById('homeWelcome');
    if (!el || typeof currentUser === 'undefined' || !currentUser) {
        if (el) el.innerHTML = '';
        return;
    }
    const hour = new Date().getHours();
    const greet = tx(typeof greetKey === 'function' ? greetKey() : 'welcome.morning');
    el.innerHTML = `
        <div class="home-welcome-inner">
            <h2>${greet}, ${escapeHtml(currentUser.username)}!</h2>
            <p>${escapeHtml(tx('welcome.back'))}</p>
        </div>`;
}

function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
        const tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;
        if (!document.body.classList.contains('dashboard-open')) return;
        e.preventDefault();
        const search = document.getElementById('globalSearchInput');
        if (search) {
            search.focus();
            search.select();
        }
    });
}

function initPremiumFeatures() {
    initScrollToTop();
    initScrollReveal();
    initKeyboardShortcuts();
}

function refreshLanguageContent() {
    if (document.getElementById('landingPage')?.classList.contains('active') && typeof loadLandingData === 'function') {
        loadLandingData();
    }
    if (typeof currentSiteSection !== 'undefined') {
        if (currentSiteSection === 'home' && typeof loadHomeSection === 'function') loadHomeSection();
        if (currentSiteSection === 'news' && typeof loadNewsSection === 'function') loadNewsSection();
        if (currentSiteSection === 'events' && typeof loadEventsSection === 'function') loadEventsSection();
        if (currentSiteSection === 'gallery' && typeof loadGallerySection === 'function') loadGallerySection();
        if (currentSiteSection === 'leaderboard' && typeof renderLeaderboard === 'function') renderLeaderboard();
        if (currentSiteSection === 'roster' && typeof renderAll === 'function') renderAll();
    }
    if (typeof updateAdminSetMenuLabel === 'function') updateAdminSetMenuLabel();
    if (typeof applyRoleUI === 'function' && typeof currentUser !== 'undefined' && currentUser) applyRoleUI();
    if (typeof renderSupportQueueSection === 'function') renderSupportQueueSection();
    if (typeof updateSupportVoiceBar === 'function') updateSupportVoiceBar();
    if (typeof updatePushSettingsUI === 'function') updatePushSettingsUI();
}

document.addEventListener('languagechange', refreshLanguageContent);
