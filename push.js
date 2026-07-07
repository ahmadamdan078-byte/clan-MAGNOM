/* MAGNOM Clan — Web Push (alerts when the site is closed) */

let pushSwRegistration = null;

const PUSH_SUPPORTED = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
}

function pushApi(path, options = {}) {
    if (typeof api === 'function') return api(path, options);
    return fetch(path, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(options.headers || {}) },
        ...options,
    }).then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Request failed');
        return data;
    });
}

function updatePushSettingsUI() {
    const status = document.getElementById('pushStatusText');
    const enableBtn = document.getElementById('pushEnableBtn');
    const disableBtn = document.getElementById('pushDisableBtn');
    if (!status) return;

    if (!PUSH_SUPPORTED) {
        status.textContent = typeof t === 'function' ? t('push.unsupported') : 'Push not supported in this browser.';
        if (enableBtn) enableBtn.style.display = 'none';
        if (disableBtn) disableBtn.style.display = 'none';
        return;
    }

    const perm = Notification.permission;
    if (perm === 'granted') {
        status.textContent = typeof t === 'function' ? t('push.statusOn') : 'Alerts are on — you will be notified even when the site is closed.';
        if (enableBtn) enableBtn.style.display = 'none';
        if (disableBtn) disableBtn.style.display = 'inline-flex';
    } else if (perm === 'denied') {
        status.textContent = typeof t === 'function' ? t('push.statusDenied') : 'Blocked in browser settings. Allow notifications for this site.';
        if (enableBtn) enableBtn.style.display = 'none';
        if (disableBtn) disableBtn.style.display = 'none';
    } else {
        status.textContent = typeof t === 'function' ? t('push.statusOff') : 'Get clan updates on your phone or desktop when you are not on the site.';
        if (enableBtn) enableBtn.style.display = 'inline-flex';
        if (disableBtn) disableBtn.style.display = 'none';
    }
}

async function registerPushServiceWorker() {
    if (!PUSH_SUPPORTED) return null;
    if (pushSwRegistration) return pushSwRegistration;
    pushSwRegistration = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
    return pushSwRegistration;
}

async function syncPushSubscription() {
    if (!PUSH_SUPPORTED || typeof currentUser === 'undefined' || !currentUser) return false;
    if (Notification.permission !== 'granted') return false;

    const reg = await registerPushServiceWorker();
    const { publicKey } = await pushApi('/api/push/vapid-public-key');
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
        sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
    }
    const json = sub.toJSON();
    await pushApi('/api/push/subscribe', {
        method: 'POST',
        body: JSON.stringify({
            endpoint: json.endpoint,
            keys: json.keys,
        }),
    });
    updatePushSettingsUI();
    return true;
}

async function enablePushNotifications() {
    if (!PUSH_SUPPORTED) {
        if (typeof notify === 'function') {
            notify(typeof t === 'function' ? t('push.unsupported') : 'Push not supported', true);
        }
        return false;
    }
    const permission = await Notification.requestPermission();
    updatePushSettingsUI();
    if (permission !== 'granted') return false;
    try {
        await syncPushSubscription();
        dismissPushPrompt();
        if (typeof notify === 'function') {
            notify(typeof t === 'function' ? t('push.enabled') : 'Notifications enabled!', false);
        }
        return true;
    } catch (err) {
        if (typeof notify === 'function') notify(err.message || 'Failed to enable notifications', true);
        return false;
    }
}

async function disablePushNotifications() {
    if (!PUSH_SUPPORTED) return;
    try {
        const reg = pushSwRegistration || await registerPushServiceWorker().catch(() => null);
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (sub) {
            const endpoint = sub.endpoint;
            await sub.unsubscribe();
            await pushApi('/api/push/unsubscribe', {
                method: 'POST',
                body: JSON.stringify({ endpoint }),
            });
        }
        if (typeof notify === 'function') {
            notify(typeof t === 'function' ? t('push.disabled') : 'Notifications turned off', false);
        }
    } catch { /* ignore */ }
    updatePushSettingsUI();
}

async function initWebPush() {
    if (!PUSH_SUPPORTED || typeof currentUser === 'undefined' || !currentUser) return;
    updatePushSettingsUI();

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data?.type === 'navigate' && typeof navigateSiteSection === 'function') {
                navigateSiteSection(event.data.section || 'home');
            }
        });
    }

    const hash = (location.hash || '').replace('#', '');
    if (hash && typeof navigateSiteSection === 'function') {
        navigateSiteSection(hash);
    }

    if (Notification.permission === 'granted') {
        try {
            await syncPushSubscription();
        } catch { /* offline */ }
    }
}

function dismissPushPrompt() {
    localStorage.setItem('magnom_push_prompt', '1');
}
