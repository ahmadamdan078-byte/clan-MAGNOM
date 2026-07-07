/* MAGNOM Clan — offline push notifications */

self.addEventListener('push', (event) => {
    let data = { title: 'MAGNOM Clan', body: 'New clan activity', section: 'home', url: '/' };
    if (event.data) {
        try {
            data = { ...data, ...event.data.json() };
        } catch { /* ignore */ }
    }
    const options = {
        body: data.body || '',
        icon: '/photos/magnom-bg.jpeg',
        badge: '/photos/magnom-bg.jpeg',
        tag: 'magnom-activity',
        renotify: true,
        data: { section: data.section || 'home', url: data.url || '/' },
    };
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            const siteOpen = clientList.some((c) => c.url.startsWith(self.location.origin) && c.visibilityState === 'visible');
            if (siteOpen) return;
            return self.registration.showNotification(data.title || 'MAGNOM Clan', options);
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const section = event.notification.data?.section || 'home';
    const url = event.notification.data?.url || '/';
    const target = url.includes('#') ? url : `${url}#${section}`;
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.startsWith(self.location.origin) && 'focus' in client) {
                    client.postMessage({ type: 'navigate', section });
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(target);
            }
        })
    );
});
