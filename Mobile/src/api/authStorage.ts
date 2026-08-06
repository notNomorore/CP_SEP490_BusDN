import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

type StorageValue = string | null;

const hasWebStorage = () => typeof window !== 'undefined' && Boolean(window.localStorage);

const isSecureStoreAvailable = () => (
  Platform.OS !== 'web'
  && typeof SecureStore.getItemAsync === 'function'
  && typeof SecureStore.setItemAsync === 'function'
  && typeof SecureStore.deleteItemAsync === 'function'
);

export const authStorage = {
  async getItem(key: string): Promise<StorageValue> {
    if (isSecureStoreAvailable()) {
      return SecureStore.getItemAsync(key);
    }

    if (hasWebStorage()) {
      return window.localStorage.getItem(key);
    }

    return null;
  },

  async setItem(key: string, value: string): Promise<void> {
    if (isSecureStoreAvailable()) {
      await SecureStore.setItemAsync(key, value);
      return;
    }

    if (hasWebStorage()) {
      window.localStorage.setItem(key, value);
    }
  },

  async deleteItem(key: string): Promise<void> {
    if (isSecureStoreAvailable()) {
      await SecureStore.deleteItemAsync(key);
      return;
    }

    if (hasWebStorage()) {
      window.localStorage.removeItem(key);
    }
  },
};

export default authStorage;
