/**
 * In-memory mock for expo-secure-store in Jest.
 * Production code must use the real module — never AsyncStorage for tokens.
 */
const store = new Map<string, string>();

module.exports = {
  getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    store.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    store.delete(key);
  }),
  isAvailableAsync: jest.fn(async () => true),
  WHEN_UNLOCKED: 0,
  AFTER_FIRST_UNLOCK: 1,
  ALWAYS: 2,
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 3,
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 4,
  ALWAYS_THIS_DEVICE_ONLY: 5,
  __resetSecureStoreMock() {
    store.clear();
  },
};
