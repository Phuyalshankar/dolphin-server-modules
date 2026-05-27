/// <reference types="jest" />

import { DeviceManager } from './devicemanager';

describe('DeviceManager (Independent)', () => {
  let dm: DeviceManager;

  beforeEach(() => {
    jest.useFakeTimers();
    dm = new DeviceManager({
      offlineTimeoutMs: 30000,           // 30 seconds
      autoOfflineCheckIntervalMs: 5000,
      debug: false,
    });
  });

  afterEach(() => {
    dm.destroy();
    jest.useRealTimers();
  });

  // ─────────────────────────────────────────────
  // Basic Registration
  // ─────────────────────────────────────────────
  describe('Registration', () => {
    it('should register a new device', () => {
      const device = dm.register('phone-1', { type: 'android', model: 'Samsung' });

      expect(device.id).toBe('phone-1');
      expect(device.metadata.type).toBe('android');
      expect(device.isOnline).toBe(true);
      expect(device.lastSeen).toBeGreaterThan(0);
    });

    it('should emit device:registered on first registration', (done) => {
      dm.on('device:registered', (device) => {
        expect(device.id).toBe('phone-2');
        done();
      });

      dm.register('phone-2');
    });

    it('should update metadata when registering existing device', () => {
      dm.register('phone-1', { type: 'android' });
      const updated = dm.register('phone-1', { model: 'Pixel' });

      expect(updated.metadata.type).toBe('android');
      expect(updated.metadata.model).toBe('Pixel');
    });

    it('should emit device:updated when metadata changes', (done) => {
      dm.register('phone-1');

      dm.on('device:updated', (device) => {
        expect(device.metadata.location).toBe('office');
        done();
      });

      dm.register('phone-1', { location: 'office' });
    });
  });

  // ─────────────────────────────────────────────
  // Unregister
  // ─────────────────────────────────────────────
  describe('Unregister', () => {
    it('should unregister a device', () => {
      dm.register('phone-1');
      const result = dm.unregister('phone-1');

      expect(result).toBe(true);
      expect(dm.get('phone-1')).toBeUndefined();
    });

    it('should emit device:unregistered and device:offline', () => {
      dm.register('phone-1');

      let unregistered = false;
      let offline = false;

      dm.on('device:unregistered', () => { unregistered = true; });
      dm.on('device:offline', () => { offline = true; });

      dm.unregister('phone-1');

      // Events are emitted synchronously
      expect(unregistered).toBe(true);
      expect(offline).toBe(true);
    });
  });

  // ─────────────────────────────────────────────
  // Heartbeat & Auto Offline
  // ─────────────────────────────────────────────
  describe('Heartbeat & Offline Detection', () => {
    it('should keep device online on heartbeat', () => {
      dm.register('phone-1');

      // Advance time close to timeout
      jest.advanceTimersByTime(25000);
      dm.heartbeat('phone-1');

      jest.advanceTimersByTime(10000); // total 35s, but heartbeat reset the timer

      const device = dm.get('phone-1');
      expect(device?.isOnline).toBe(true);
    });

    it('should mark device offline after timeout', () => {
      dm.register('phone-1');

      jest.advanceTimersByTime(31000); // past 30s timeout

      const device = dm.get('phone-1');
      expect(device?.isOnline).toBe(false);
    });

    it('should emit device:offline on auto timeout', (done) => {
      dm.register('phone-1');

      dm.on('device:offline', ({ id, reason }) => {
        expect(id).toBe('phone-1');
        expect(reason).toBe('timeout');
        done();
      });

      jest.advanceTimersByTime(31000);
    });

    it('should manually mark offline', () => {
      dm.register('phone-1');
      dm.markOffline('phone-1', 'manual');

      const device = dm.get('phone-1');
      expect(device?.isOnline).toBe(false);
    });
  });

  // ─────────────────────────────────────────────
  // Metadata & Queries
  // ─────────────────────────────────────────────
  describe('Metadata & Queries', () => {
    it('should update metadata', () => {
      dm.register('phone-1');
      const updated = dm.updateMetadata('phone-1', { version: '2.1' });

      expect(updated?.metadata.version).toBe('2.1');
    });

    it('should return correct isOnline status', () => {
      dm.register('phone-1');
      expect(dm.isOnline('phone-1')).toBe(true);

      dm.markOffline('phone-1');
      expect(dm.isOnline('phone-1')).toBe(false);
    });

    it('should list only online devices with getOnline()', () => {
      dm.register('phone-1');
      dm.register('phone-2');
      dm.markOffline('phone-2');

      const online = dm.getOnline();
      expect(online.length).toBe(1);
      expect(online[0].id).toBe('phone-1');
    });
  });

  // ─────────────────────────────────────────────
  // Subscriptions
  // ─────────────────────────────────────────────
  describe('Subscriptions', () => {
    it('should subscribe and unsubscribe a device', () => {
      dm.register('phone-1');

      dm.subscribe('phone-1', 'camera/living');
      dm.subscribe('phone-1', 'alerts');

      expect(dm.getSubscriptions('phone-1')).toContain('camera/living');

      dm.unsubscribe('phone-1', 'alerts');
      expect(dm.getSubscriptions('phone-1')).not.toContain('alerts');
    });
  });

  // ─────────────────────────────────────────────
  // Destroy
  // ─────────────────────────────────────────────
  describe('Destroy', () => {
    it('should clear all devices on destroy', () => {
      dm.register('phone-1');
      dm.register('phone-2');

      dm.destroy();

      expect(dm.list().length).toBe(0);
    });
  });
});
