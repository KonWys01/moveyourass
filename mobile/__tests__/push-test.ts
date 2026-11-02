import * as Notifications from 'expo-notifications';

import {
  registerDevice,
  targetFor,
  unregisterDevice,
} from '@/push';

jest.mock('expo-notifications', () => ({
  setNotificationChannelAsync: jest.fn(async () => null),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getDevicePushTokenAsync: jest.fn(),
  addPushTokenListener: jest.fn(),
  setNotificationHandler: jest.fn(),
  AndroidImportance: { MAX: 5 },
}));

const N = Notifications as unknown as {
  setNotificationChannelAsync: jest.Mock;
  getPermissionsAsync: jest.Mock;
  requestPermissionsAsync: jest.Mock;
  getDevicePushTokenAsync: jest.Mock;
};

const api = { post: jest.fn(), del: jest.fn() } as never as Parameters<
  typeof registerDevice
>[0] & { post: jest.Mock; del: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  N.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
  N.getDevicePushTokenAsync.mockResolvedValue({ data: 'fcm:token_1' });
  api.post.mockResolvedValue(undefined);
  api.del.mockResolvedValue(undefined);
});

test('registers the native token after creating the channel', async () => {
  const token = await registerDevice(api);

  expect(token).toBe('fcm:token_1');
  expect(api.post).toHaveBeenCalledWith('/devices', { token: 'fcm:token_1' });
  expect(N.setNotificationChannelAsync.mock.invocationCallOrder[0]).toBeLessThan(
    N.getDevicePushTokenAsync.mock.invocationCallOrder[0],
  );
});

test('asks for permission when not yet granted, stops if denied', async () => {
  N.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
  N.requestPermissionsAsync.mockResolvedValue({ status: 'denied' });

  const token = await registerDevice(api);

  expect(token).toBeNull();
  expect(api.post).not.toHaveBeenCalled();
  expect(N.getDevicePushTokenAsync).not.toHaveBeenCalled();
});

test('never throws when FCM or the backend fail', async () => {
  N.getDevicePushTokenAsync.mockRejectedValue(new Error('no play services'));
  await expect(registerDevice(api)).resolves.toBeNull();

  N.getDevicePushTokenAsync.mockResolvedValue({ data: 'x' });
  api.post.mockRejectedValue(new Error('500'));
  await expect(registerDevice(api)).resolves.toBeNull();
});

test('unregister deletes the encoded token once, ignoring failures', async () => {
  await registerDevice(api);
  api.del.mockRejectedValue(new Error('401'));

  await unregisterDevice(api);
  await unregisterDevice(api); // second call: nothing left to delete

  expect(api.del).toHaveBeenCalledTimes(1);
  expect(api.del).toHaveBeenCalledWith('/devices/fcm%3Atoken_1');
});

test('notification taps map to screens', () => {
  expect(targetFor({ kind: 'like', entry_id: 'e1' })).toEqual({
    path: '/entry/e1',
  });
  expect(targetFor({ kind: 'new_follower', user_id: 'u1' })).toEqual({
    path: '/user/u1',
  });
  expect(targetFor({ kind: 'reminder' })).toBeNull();
  expect(targetFor(undefined)).toBeNull();
  expect(targetFor({ entry_id: 5 })).toBeNull();
});
