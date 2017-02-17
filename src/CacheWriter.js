/**
 *  Implements the CacheWriter interface specified by
 *  RelayTypes, uses an instance of CacheRecordStore
 *  to manage the CacheRecord instances
 *  @flow
 */

import ReadWriteLock from 'rwlock';
import Cycle from 'cycle';

import CacheRecordStore from './CacheRecordStore';
import LocalStorageCacheStorageAdapter from './LocalStorageCacheStorageAdapter';
import type { CacheRecord } from './CacheRecordStore';

const DEFAULT_CACHE_KEY: string = '__RelayCacheManager__';

export type CacheStorageAdapter = {
  getItem(key: string, callback: (error: any, value: ?string) => void): void;
  setItem(key: string, data: string, callback: (error: any) => void): void;
  removeItem(key: string, callback: (error: any) => void): void;
};

export type CacheWriterOptions = {
  cacheKey?: string,
  cacheStorageAdapter?: CacheStorageAdapter,
};

export default class CacheWriter {
  cache: CacheRecordStore;
  cacheStorageAdapter: CacheStorageAdapter;
  cacheKey: string;
  lock: ReadWriteLock;

  constructor(options: CacheWriterOptions = {}) {
    this.cacheKey = options.cacheKey || DEFAULT_CACHE_KEY;
    this.cacheStorageAdapter = options.cacheStorageAdapter || new LocalStorageCacheStorageAdapter();

    this.cache = new CacheRecordStore();

    this.lock = new ReadWriteLock();

    this.lock.readLock(release => {
      this.cacheStorageAdapter.getItem(this.cacheKey, (error: any, value: ?string) => {
        if (value && !error) {
          this.cache.ingestJSON(Cycle.retrocycle(JSON.parse(value)));
        }
        release();
      });
    });
  }

  clearStorage() {
    this.lock.writeLock(release => {
      this.cacheStorageAdapter.removeItem(this.cacheKey, () => {
        release();
      });
      this.cache = new CacheRecordStore();
    });
  }

  writeField(
    dataId: string,
    field: string,
    value: ?mixed,
    typeName: ?string
  ) {
    this.lock.writeLock(release => {
      let record = this.cache.records[dataId];
      if (!record) {
        record = {
          __dataID__: dataId,
          __typename: typeName,
        };
      }
      record[field] = value;
      this.cache.records[dataId] = record;
      try {
        const serialized = JSON.stringify(Cycle.decycle(this.cache.egestJSON()));
        this.cacheStorageAdapter.setItem(this.cacheKey, serialized, () => {
          release();
        });
      } catch (err) {
        release();
      }
    });
  }

  writeNode(dataId: string, record: CacheRecord): void {
    this.lock.writeLock(release => {
      this.cache.writeRecord(dataId, record);
    });
  }

  readNode(dataId: string, callback: (error: any, value: any) => void): void {
    this.lock.readLock(release => {
      const record = this.cache.readNode(dataId);
      release();
      setImmediate(callback.bind(null, null, record));
    });
  }

  writeRootCall(
    storageKey: string,
    identifyingArgValue: string,
    dataId: string
  ): void {
    this.lock.writeLock(release => {
      this.cache.writeRootCall(storageKey, identifyingArgValue, dataId);
      release();
    });
  }

  readRootCall(
    callName: string,
    callValue: string,
    callback: (error: any, value: any) => void
  ) {
    this.lock.readLock(release => {
      const dataId = this.cache.getDataIdFromRootCallName(callName, callValue);
      release();
      setImmediate(callback.bind(null, null, dataId));
    });
  }

}
