import { describe, it, expect, vi } from 'vitest';
import { playNotificationSound } from '../audioAlert';
import { isPushSupported, getPushPermission, sendPushNotification } from '../pushNotification';

describe('Notification & Alert Utilities', () => {
  it('handles playNotificationSound safely when AudioContext is mocked or absent', () => {
    expect(() => playNotificationSound('default')).not.toThrow();
    expect(() => playNotificationSound('circuit_breaker')).not.toThrow();
  });

  it('checks push notification support in test environment', () => {
    const supported = isPushSupported();
    expect(typeof supported).toBe('boolean');
  });

  it('gets push permission state safely', () => {
    const perm = getPushPermission();
    expect(typeof perm).toBe('string');
  });

  it('handles sendPushNotification when permission is not granted', () => {
    const res = sendPushNotification('Test Alert', { body: 'Hello' });
    expect(res).toBeNull();
  });
});
