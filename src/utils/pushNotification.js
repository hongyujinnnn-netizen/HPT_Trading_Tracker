/**
 * Browser Desktop Push Notification Helper
 * Wraps the Web Notification API for background alerts.
 */

export function isPushSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getPushPermission() {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestPushPermission() {
  if (!isPushSupported()) return 'unsupported';
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (e) {
    console.error('[pushNotification] Permission request failed:', e);
    return 'denied';
  }
}

export function sendPushNotification(title, options = {}) {
  if (!isPushSupported()) return null;
  if (Notification.permission !== 'granted') return null;

  try {
    const notification = new Notification(title, {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: options.tag || 'tradepulse-alert',
      renotify: true,
      body: options.body || '',
      ...options,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
      if (options.onClick) options.onClick();
    };

    return notification;
  } catch (e) {
    console.error('[pushNotification] Failed to create notification:', e);
    return null;
  }
}
