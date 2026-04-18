'use client'

import { useEffect, useRef, useCallback } from 'react'

// ── VAPID public key (generate with: npx web-push generate-vapid-keys)
// Store in .env.local as NEXT_PUBLIC_VAPID_PUBLIC_KEY
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export interface NotificationPayload {
  title: string
  body: string
  orderId?: string
  tableNumber?: string
  orderNumber?: string
}

export function usePushNotifications() {
  const swRef = useRef<ServiceWorkerRegistration | null>(null)
  const subscriptionRef = useRef<PushSubscription | null>(null)

  // Register Service Worker
  const registerSW = useCallback(async (): Promise<ServiceWorkerRegistration | null> => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      swRef.current = reg
      return reg
    } catch (err) {
      console.error('[Push] SW registration failed:', err)
      return null
    }
  }, [])

  // Request permission + subscribe to push
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      console.warn('[Push] Notifications not supported')
      return false
    }

    // Request permission
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      console.warn('[Push] Permission denied')
      return false
    }

    const reg = swRef.current ?? await registerSW()
    if (!reg) return false

    try {
      // Unsubscribe from existing subscription first
      const existing = await reg.pushManager.getSubscription()
      if (existing) await existing.unsubscribe()

      // Subscribe with VAPID key (if configured)
      const options: PushSubscriptionOptionsInit = {
        userVisibleOnly: true,
        ...(VAPID_PUBLIC_KEY && {
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        })
      }

      const subscription = await reg.pushManager.subscribe(options)
      subscriptionRef.current = subscription

      // TODO: Save subscription to Supabase for server-side push
      // await saveSubscriptionToDb(subscription)
      console.log('[Push] Subscribed successfully:', subscription.endpoint)
      return true
    } catch (err) {
      console.error('[Push] Subscription failed:', err)
      return false
    }
  }, [registerSW])

  // Show a LOCAL notification (no server needed — works immediately)
  // Use this as fallback when tab is in foreground
  const showLocalNotification = useCallback(async (payload: NotificationPayload) => {
    const reg = swRef.current
    if (!reg) return

    const permission = Notification.permission
    if (permission !== 'granted') return

    await reg.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      requireInteraction: true,
      tag: `order-${payload.orderId ?? Date.now()}`,
      renotify: true,
      data: { url: '/dashboard/orders', orderId: payload.orderId },
    } as NotificationOptions)
  }, [])

  // Check if already subscribed
  const getSubscriptionStatus = useCallback(async () => {
    const reg = swRef.current
    if (!reg) return { subscribed: false, permission: Notification.permission }
    const sub = await reg.pushManager.getSubscription()
    return {
      subscribed: !!sub,
      permission: Notification.permission,
      subscription: sub
    }
  }, [])

  // Unsubscribe
  const unsubscribe = useCallback(async () => {
    const sub = subscriptionRef.current
    if (sub) {
      await sub.unsubscribe()
      subscriptionRef.current = null
    }
  }, [])

  // Auto-register SW on mount
  useEffect(() => {
    registerSW()
  }, [registerSW])

  return {
    subscribe,
    unsubscribe,
    showLocalNotification,
    getSubscriptionStatus,
    isSupported: typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'Notification' in window
  }
}

// ── STANDALONE: trigger push from server (Supabase Edge Function) ─────────────
// Call this from a Supabase Edge Function when an order is inserted
// POST to /functions/v1/send-push with { subscription, payload }
export async function triggerServerPush(
  subscription: PushSubscription,
  payload: NotificationPayload
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) return

  await fetch(`${supabaseUrl}/functions/v1/send-push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: subscription.toJSON(), payload })
  })
}
