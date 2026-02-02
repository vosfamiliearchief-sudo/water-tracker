const CACHE_NAME = 'water-tracker-v1';
const ASSETS = ['./', './index.html', './manifest.json'];

// Install — cache assets
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch — serve from cache, fallback to network
self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then(cached => cached || fetch(e.request))
    );
});

// Handle scheduled notification messages from the app
self.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'SCHEDULE_NOTIFICATIONS') {
        const reminders = e.data.reminders || [];
        // Clear any existing scheduled timers
        if (self._reminderTimers) {
            self._reminderTimers.forEach(t => clearTimeout(t));
        }
        self._reminderTimers = [];

        const now = new Date();
        for (const time of reminders) {
            const [h, m] = time.split(':').map(Number);
            const target = new Date();
            target.setHours(h, m, 0, 0);
            if (target <= now) continue;

            const delay = target - now;
            const timer = setTimeout(() => {
                self.registration.showNotification('Water Tracker', {
                    body: `Tijd om water te drinken! (${time})`,
                    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="80" font-size="80">💧</text></svg>',
                    tag: 'water-reminder-' + time,
                    actions: [
                        { action: 'drink', title: 'Gedaan!' },
                        { action: 'dismiss', title: 'Later' }
                    ]
                });
            }, delay);
            self._reminderTimers.push(timer);
        }
    }
});

// Handle notification click
self.addEventListener('notificationclick', (e) => {
    e.notification.close();

    if (e.action === 'drink') {
        // Tell the app to add a glass
        e.waitUntil(
            self.clients.matchAll({ type: 'window' }).then(clients => {
                for (const client of clients) {
                    client.postMessage({ type: 'ADD_GLASS' });
                    client.focus();
                    return;
                }
                // If no window open, open one
                self.clients.openWindow('./');
            })
        );
    } else {
        // Just focus the app
        e.waitUntil(
            self.clients.matchAll({ type: 'window' }).then(clients => {
                if (clients.length > 0) {
                    clients[0].focus();
                } else {
                    self.clients.openWindow('./');
                }
            })
        );
    }
});
