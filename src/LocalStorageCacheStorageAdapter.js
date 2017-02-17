/**
 *  Implements the CacheStorageAdapter for browser localStorage
 *  @flow
 */

export default class LocalStorageCacheStorageAdapter {
  getItem(key: string, callback: (error: any, value: ?string) => void): void {
    const item = localStorage.getItem(key);
    setImmediate(callback.bind(null, null, item));
  }

  setItem(key: string, data: string, callback: (error: any) => void): void {
    localStorage.setItem(key, data);
    callback();
  }

  removeItem(key: string, callback: (error: any) => void): void {
    localStorage.removeItem(key);
    callback();
  }
}