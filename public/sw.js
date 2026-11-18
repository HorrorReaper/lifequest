// LifeQuest service worker: web push only (docs/features/push-notifications.md).
// No caching and no offline shell. Registered from Settings by
// src/lib/push-client.ts when a user turns reminders on.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Only a path on this site may be opened from a notification; mirrors
// safeNotificationPath in src/lib/push-subscription.ts.
function safePath(path) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
    return '/dashboard'
  }
  return path
}

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = {}
  }

  const title = typeof data.title === 'string' && data.title ? data.title : 'LifeQuest'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === 'string' ? data.body : '',
      icon: '/icons/icon-192.png',
      tag: typeof data.tag === 'string' ? data.tag : undefined,
      data: { url: safePath(data.url) },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(safePath(event.notification.data && event.notification.data.url), self.location.origin)

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (new URL(client.url).origin === target.origin && 'focus' in client) {
          return client.focus().then((focused) => (focused && 'navigate' in focused ? focused.navigate(target.href) : focused))
        }
      }
      return self.clients.openWindow(target.href)
    })
  )
})
