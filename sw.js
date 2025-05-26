self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open("static").then(cache => {
            return cache.addAll([
                "./",
                "./styles/style.css",
                "./styles/leaflet.css",
                "./images/icon_192.png"
            ]).catch(error => {
                console.error("Failed to cache static resources:", error);
            });
        })
    );
});

self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);

    // Перевірка чи це тайл OpenStreetMap (або інший URL з тайлами)
    if (url.hostname.includes("tile.openstreetmap.org")) {
        event.respondWith(
            caches.open("tiles").then(cache => {
                return cache.match(event.request).then(cachedResponse => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    return fetch(event.request).then(networkResponse => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    }).catch(err => {
                        console.error("Tile fetch failed:", err);
                        return new Response("<h1>Помилка завантаження тайлів</h1>", {
                            status: 500,
                            headers: { "Content-Type": "text/html" }
                        });
                    });
                });
            })
        );
    } else {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(event.request).catch(err => {
                    console.error("Fetch failed:", err);
                    return new Response("<h1>Помилка завантаження ресурсу</h1>", {
                        status: 500,
                        headers: { "Content-Type": "text/html" }
                    });
                });
            })
        );
    }
});

self.addEventListener("activate", event => {
    const cacheWhitelist = ["static", "tiles"];

    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.map(key => {
                    if (!cacheWhitelist.includes(key)) {
                        return caches.delete(key);
                    }
                })
            ).then(() => {
                if (self.clients && typeof self.clients.claim === 'function') {
                    self.clients.claim();
                }
            });
        })
    );
});

self.addEventListener("message", (event) => {
    console.log("SW received message", event.data);
    const data = event.data;

    if (data && data.type === "delayed-notification") {
        setTimeout(() => {
            self.registration.showNotification("Тестове сповіщення", {
                body: data.message || "Тестове сповіщення",
                vibrate: [200, 100, 200],
                tag: "delayed-alert"
            });
        }, data.delay || 60000);
    }
});