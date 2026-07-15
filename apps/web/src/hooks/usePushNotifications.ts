"use client";

import { useEffect, useRef } from "react";

interface UsePushNotificationsOptions {
  userId?: string | null;
  /** Called when permission is denied */
  onDenied?: () => void;
}

/**
 * usePushNotifications
 * Registers the service worker, requests notification permission, and subscribes
 * the device to TERA's push service once the user is authenticated.
 */
export function usePushNotifications({ userId, onDenied }: UsePushNotificationsOptions) {
  const registered = useRef(false);

  useEffect(() => {
    if (!userId || registered.current) return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    registered.current = true;

    (async () => {
      try {
        // 1. Register service worker
        const registration = await navigator.serviceWorker.register(
          "/service-worker.js",
          { scope: "/" }
        );
        await navigator.serviceWorker.ready;

        // 2. Check / request notification permission
        let permission = Notification.permission;
        if (permission === "default") {
          permission = await Notification.requestPermission();
        }
        if (permission === "denied") {
          onDenied?.();
          return;
        }
        if (permission !== "granted") return;

        // 3. Fetch VAPID public key
        const res = await fetch("/api/push");
        if (!res.ok) return;
        const { publicKey } = await res.json();
        if (!publicKey) return;

        // 4. Check existing subscription
        const existingSub = await registration.pushManager.getSubscription();
        if (existingSub) {
          // Already subscribed — just make sure the server knows about it
          await syncSubscription(existingSub);
          return;
        }

        // 5. Subscribe
        const sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });

        await syncSubscription(sub);
      } catch (err) {
        console.warn("[push] Registration failed:", err);
      }
    })();
  }, [userId]);
}

/** Send/update the subscription on our server */
async function syncSubscription(sub: PushSubscription) {
  const json = sub.toJSON();
  await fetch("/api/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
    }),
  });
}

/** Convert base64 VAPID key to Uint8Array with a plain ArrayBuffer */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const chars = [...rawData].map((char) => char.charCodeAt(0));
  const buffer = new ArrayBuffer(chars.length);
  const view = new Uint8Array(buffer);
  chars.forEach((c, i) => { view[i] = c; });
  return view;
}
