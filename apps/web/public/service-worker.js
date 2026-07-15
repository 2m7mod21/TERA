// TERA Platform - Service Worker for Push Notifications
// Version: 1.0.0

const CACHE_NAME = "tera-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

// ─── Push Event Handler ───────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "TERA", body: event.data.text() };
  }

  const {
    title = "TERA",
    body = "You have a new notification",
    icon = "/icon-192.png",
    badge = "/badge-72.png",
    url = "/",
    tag = "tera-notification",
    type = "SYSTEM",
  } = data;

  const options = {
    body,
    icon,
    badge,
    tag,
    data: { url, type },
    renotify: true,
    requireInteraction: false,
    silent: false,
    vibrate: [200, 100, 200],
    actions: [
      { action: "open", title: "View" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ─── Notification Click Handler ───────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // If a tab is already open, focus it and navigate
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin)) {
            client.focus();
            client.navigate(url);
            return;
          }
        }
        // Otherwise open a new tab
        return clients.openWindow(url);
      })
  );
});
