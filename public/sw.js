// Service Worker for FNB ERP PWA
// Handles push notifications and offline caching

const CACHE_NAME = 'fnb-erp-v1'
const STATIC_ASSETS = [
  '/dashboard/orders',
  '/manifest.json',
]

// ── INSTALL ──────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// ── ACTIVATE ─────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ── FETCH (network-first for API, cache-first for static) ────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  // Skip supabase API calls — always network
  if (url.hostname.includes('supabase.co')) return
  // For navigation, try network first then cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    )
  }
})

// ── PUSH NOTIFICATION ────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = { title: 'New Order!', body: 'A new order just came in.', orderId: null, tableNumber: null }
  try {
    data = { ...data, ...event.data.json() }
  } catch {}

  const options = {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200, 100, 200],
    requireInteraction: true,           // stays visible until user taps
    tag: `order-${data.orderId ?? Date.now()}`,
    renotify: true,
    data: {
      url: '/dashboard/orders',
      orderId: data.orderId,
    },
    actions: [
      { action: 'view', title: 'View Order' },
      { action: 'dismiss', title: 'Dismiss' },
    ]
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  )
})

// ── NOTIFICATION CLICK ───────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'dismiss') return

  const targetUrl = event.notification.data?.url ?? '/dashboard/orders'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // Focus existing tab if open
      const existing = clients.find(c => c.url.includes('/dashboard'))
      if (existing) {
        existing.focus()
        existing.postMessage({ type: 'NEW_ORDER', orderId: event.notification.data?.orderId })
        return
      }
      // Open new tab
      return self.clients.openWindow(targetUrl)
    })
  )
})

// ── BACKGROUND SYNC (retry failed requests) ──────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-orders') {
    event.waitUntil(syncPendingOrders())
  }
})

async function syncPendingOrders() {
  // Future: retry failed order status updates when back online
  console.log('[SW] Background sync triggered')
}
