/* MAGNOM Clan — Admin support call queue */

let supportQueuePoll = null;
let supportQueueData = { mine: null, waiting: [], active: [], waitingCount: 0 };
const SUPPORT_QUEUE_POLL_FAST_MS = 2500;
const SUPPORT_QUEUE_POLL_SLOW_MS = 12000;

function shouldPollSupportQueue() {
    if (typeof currentUser === 'undefined' || !currentUser) return false;
    if (typeof isAdmin === 'function' && isAdmin()) return true;
    if (supportQueueData.mine) return true;
    if (typeof currentSiteSection !== 'undefined' && currentSiteSection === 'support') return true;
    return false;
}

function supportQueuePollInterval() {
    if (supportQueueData.mine?.status === 'active' || supportQueueData.mine?.status === 'waiting') {
        return SUPPORT_QUEUE_POLL_FAST_MS;
    }
    if (typeof isAdmin === 'function' && isAdmin() && ((supportQueueData.waiting || []).length > 0)) {
        return SUPPORT_QUEUE_POLL_FAST_MS;
    }
    return SUPPORT_QUEUE_POLL_SLOW_MS;
}

async function supportQueueApi(path, options = {}) {
    if (typeof api === 'function') return api(path, options);
    const res = await fetch(path, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(options.headers || {}) },
        ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const hint = res.status === 404 && path.includes('/api/support-queue')
            ? 'Restart the server to load Admin Support, then refresh the page.'
            : '';
        throw new Error(data.error || hint || `Request failed (${res.status})`);
    }
    return data;
}

function supportQueueTx(key, fallback) {
    return typeof t === 'function' ? t(key) : fallback;
}

function formatWaitTime(iso) {
    if (!iso) return '0:00';
    try {
        const start = typeof parseDbDate === 'function' ? parseDbDate(iso) : new Date(iso.replace(' ', 'T'));
        if (!start) return '0:00';
        const secs = Math.max(0, Math.floor((Date.now() - start.getTime()) / 1000));
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${String(s).padStart(2, '0')}`;
    } catch {
        return '0:00';
    }
}

function updateSupportNavBadge() {
    const badge = document.getElementById('supportNavBadge');
    if (!badge) return;
    const mine = supportQueueData.mine;
    const adminWaiting = typeof isAdmin === 'function' && isAdmin()
        ? (supportQueueData.waiting || []).length
        : 0;
    const count = mine ? 1 : adminWaiting;
    if (count > 0) {
        badge.textContent = adminWaiting > 0 ? String(adminWaiting) : '•';
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

function renderSupportQueueSection() {
    const memberEl = document.getElementById('supportMemberPanel');
    const adminEl = document.getElementById('supportAdminPanel');
    if (!memberEl) return;

    const mine = supportQueueData.mine;
    const idle = !mine;

    if (idle) {
        memberEl.innerHTML = `
            <div class="support-call-idle">
                <div class="support-call-icon">📞</div>
                <h3>${escapeHtml(supportQueueTx('support.callTitle', 'Call an admin'))}</h3>
                <p>${escapeHtml(supportQueueTx('support.callDesc', 'Need real help? Join the queue and an admin will answer your call.'))}</p>
                <div class="form-group">
                    <label for="supportCallNote">${escapeHtml(supportQueueTx('support.noteLabel', 'What do you need help with?'))}</label>
                    <textarea id="supportCallNote" rows="3" maxlength="500" placeholder="${escapeHtml(supportQueueTx('support.notePh', 'Describe your issue…'))}"></textarea>
                </div>
                <button type="button" class="btn-primary support-call-join-btn" onclick="joinSupportQueue()">
                    ${escapeHtml(supportQueueTx('support.joinQueue', 'Join waiting room'))}
                </button>
                ${supportQueueData.waitingCount > 0 ? `<p class="support-queue-hint">${escapeHtml(supportQueueTx('support.othersWaiting', '{n} member(s) waiting').replace('{n}', supportQueueData.waitingCount))}</p>` : ''}
            </div>
        `;
    } else if (mine.status === 'waiting') {
        memberEl.innerHTML = `
            <div class="support-call-waiting">
                <div class="support-call-rings" aria-hidden="true"><span></span><span></span><span></span></div>
                <div class="support-call-icon pulse">📞</div>
                <h3>${escapeHtml(supportQueueTx('support.waitingTitle', 'Waiting for an admin…'))}</h3>
                <p class="support-wait-position">${escapeHtml(supportQueueTx('support.position', 'Your position'))}: <strong>#${mine.position || 1}</strong></p>
                <p class="support-wait-timer">${escapeHtml(supportQueueTx('support.waitTime', 'Wait time'))}: <strong id="supportWaitTimer">${formatWaitTime(mine.createdAt)}</strong></p>
                ${mine.note ? `<p class="support-wait-note"><em>${escapeHtml(mine.note)}</em></p>` : ''}
                <p class="support-wait-hint">${escapeHtml(supportQueueTx('support.waitHint', 'Keep this page open. You will be notified when an admin answers.'))}</p>
                <button type="button" class="btn-secondary" onclick="leaveSupportQueue()">${escapeHtml(supportQueueTx('support.cancelWait', 'Leave waiting room'))}</button>
            </div>
        `;
    } else if (mine.status === 'active') {
        memberEl.innerHTML = `
            <div class="support-call-connected">
                <div class="support-call-icon connected">🎙️</div>
                <h3>${escapeHtml(supportQueueTx('support.connectedTitle', 'Admin is with you'))}</h3>
                <p>${escapeHtml(supportQueueTx('support.connectedTo', 'Connected with'))}: <strong>${escapeHtml(mine.adminUsername || 'Admin')}</strong></p>
                <p class="support-wait-hint">${escapeHtml(supportQueueTx('support.voiceHint', 'Use the voice bar below to talk. Allow microphone access when asked.'))}</p>
                <div class="support-connected-actions">
                    <button type="button" class="btn-secondary" onclick="completeSupportCall(${mine.id})">${escapeHtml(supportQueueTx('support.endCall', 'End call'))}</button>
                </div>
            </div>
        `;
    }

    if (adminEl && typeof isAdmin === 'function' && isAdmin()) {
        const waiting = supportQueueData.waiting || [];
        const active = supportQueueData.active || [];
        adminEl.style.display = 'block';
        adminEl.innerHTML = `
            <h2 class="section-title">${escapeHtml(supportQueueTx('support.adminTitle', '🛎️ Support queue'))}</h2>
            <p class="card-meta">${escapeHtml(supportQueueTx('support.adminDesc', 'Members waiting for live admin help.'))}</p>
            <div class="support-admin-grid">
                <div class="support-admin-col">
                    <h3>${escapeHtml(supportQueueTx('support.waitingList', 'Waiting'))} (${waiting.length})</h3>
                    ${waiting.length ? waiting.map((entry) => `
                        <div class="support-queue-card">
                            <div class="support-queue-card-head">
                                <strong>${escapeHtml(entry.username)}</strong>
                                <span>${formatWaitTime(entry.createdAt)}</span>
                            </div>
                            ${entry.note ? `<p>${escapeHtml(entry.note)}</p>` : ''}
                            <button type="button" class="btn-primary btn-sm" onclick="claimSupportCall(${entry.id})">${escapeHtml(supportQueueTx('support.answerCall', 'Answer call'))}</button>
                        </div>
                    `).join('') : `<p class="card-meta">${escapeHtml(supportQueueTx('support.noWaiting', 'No one waiting right now.'))}</p>`}
                </div>
                <div class="support-admin-col">
                    <h3>${escapeHtml(supportQueueTx('support.activeList', 'Active calls'))} (${active.length})</h3>
                    ${active.length ? active.map((entry) => `
                        <div class="support-queue-card active">
                            <div class="support-queue-card-head">
                                <strong>${escapeHtml(entry.username)}</strong>
                                <span>${escapeHtml(entry.adminUsername || '')}</span>
                            </div>
                            ${entry.note ? `<p>${escapeHtml(entry.note)}</p>` : ''}
                            <button type="button" class="btn-secondary btn-sm" onclick="completeSupportCall(${entry.id})">${escapeHtml(supportQueueTx('support.endCall', 'End call'))}</button>
                            <p class="card-meta">${escapeHtml(supportQueueTx('support.voiceHintShort', 'Voice bar appears below when connected.'))}</p>
                        </div>
                    `).join('') : `<p class="card-meta">${escapeHtml(supportQueueTx('support.noActive', 'No active calls.'))}</p>`}
                </div>
            </div>
        `;
    } else if (adminEl) {
        adminEl.style.display = 'none';
    }

    updateSupportNavBadge();
}

async function refreshSupportQueue() {
    if (typeof currentUser === 'undefined' || !currentUser) return;
    if (!shouldPollSupportQueue()) return;
    try {
        const data = await supportQueueApi('/api/support-queue');
        const prev = supportQueueData.mine;
        supportQueueData = {
            mine: data.mine || null,
            waiting: data.waiting || [],
            active: data.active || [],
            waitingCount: data.waitingCount || 0,
        };
        if (prev?.status === 'waiting' && supportQueueData.mine?.status === 'active') {
            if (typeof notify === 'function') {
                notify(`📞 ${supportQueueTx('support.adminAnswered', 'An admin answered your call!')}`, false);
            }
        }
        renderSupportQueueSection();
        if (typeof ensureSupportVoiceCall === 'function') ensureSupportVoiceCall();
    } catch { /* logged out */ }
}

async function joinSupportQueue() {
    const note = document.getElementById('supportCallNote')?.value?.trim() || '';
    try {
        await supportQueueApi('/api/support-queue/join', {
            method: 'POST',
            body: JSON.stringify({ note }),
        });
        if (typeof notify === 'function') {
            notify(supportQueueTx('support.joined', 'You joined the waiting room'), false);
        }
        await refreshSupportQueue();
    } catch (err) {
        if (typeof notify === 'function') notify(err.message, true);
    }
}

async function leaveSupportQueue() {
    try {
        if (typeof stopSupportVoiceCall === 'function') await stopSupportVoiceCall(true);
        await supportQueueApi('/api/support-queue/leave', { method: 'POST', body: '{}' });
        supportQueueData.mine = null;
        renderSupportQueueSection();
        if (typeof notify === 'function') {
            notify(supportQueueTx('support.left', 'You left the waiting room'), false);
        }
    } catch (err) {
        if (typeof notify === 'function') notify(err.message, true);
    }
}

async function claimSupportCall(entryId) {
    try {
        await supportQueueApi(`/api/support-queue/claim/${entryId}`, { method: 'POST', body: '{}' });
        await refreshSupportQueue();
        if (typeof ensureSupportVoiceCall === 'function') ensureSupportVoiceCall();
        if (typeof notify === 'function') {
            notify(supportQueueTx('support.claimed', 'Call connected'), false);
        }
    } catch (err) {
        if (typeof notify === 'function') notify(err.message, true);
    }
}

async function completeSupportCall(entryId) {
    try {
        if (typeof stopSupportVoiceCall === 'function') await stopSupportVoiceCall(true);
        await supportQueueApi(`/api/support-queue/complete/${entryId}`, { method: 'POST', body: '{}' });
        await refreshSupportQueue();
    } catch (err) {
        if (typeof notify === 'function') notify(err.message, true);
    }
}

function startSupportQueuePoll() {
    if (supportQueuePoll) return;
    refreshSupportQueue();
    const tick = () => {
        refreshSupportQueue();
        const timer = document.getElementById('supportWaitTimer');
        const mine = supportQueueData.mine;
        if (timer && mine?.status === 'waiting') {
            timer.textContent = formatWaitTime(mine.createdAt);
        }
        if (supportQueuePoll) {
            clearInterval(supportQueuePoll);
            supportQueuePoll = setInterval(tick, supportQueuePollInterval());
        }
    };
    supportQueuePoll = setInterval(tick, supportQueuePollInterval());
}

function stopSupportQueuePoll() {
    if (supportQueuePoll) {
        clearInterval(supportQueuePoll);
        supportQueuePoll = null;
    }
    if (typeof stopSupportVoiceCall === 'function') stopSupportVoiceCall(true);
    supportQueueData = { mine: null, waiting: [], active: [], waitingCount: 0 };
    updateSupportNavBadge();
}

async function loadSupportSection() {
    startSupportQueuePoll();
    if (typeof currentUser !== 'undefined' && currentUser) {
        try {
            const data = await supportQueueApi('/api/support-queue');
            supportQueueData = {
                mine: data.mine || null,
                waiting: data.waiting || [],
                active: data.active || [],
                waitingCount: data.waitingCount || 0,
            };
        } catch { /* ignore */ }
    }
    renderSupportQueueSection();
    if (typeof ensureSupportVoiceCall === 'function') ensureSupportVoiceCall();
}

function completeSupportCallFromVoiceBar() {
    const entry = typeof getMyActiveSupportCallEntry === 'function'
        ? getMyActiveSupportCallEntry()
        : (supportQueueData.mine?.status === 'active' ? supportQueueData.mine : null);
    if (entry?.id) completeSupportCall(entry.id);
}
