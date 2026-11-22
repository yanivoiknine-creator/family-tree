import type { FamilyData } from '../types';
import { blobToDataUrl } from '../lib/image';
import { DATA_KEY, SEED_DATA } from './localSeed';

/**
 * The browser-only prototype store (local mode). Cloud mode uses CloudStore instead.
 */
export class LocalStore {
  async load(): Promise<FamilyData> {
    try {
      const raw = localStorage.getItem(DATA_KEY);
      if (raw) return JSON.parse(raw) as FamilyData;
    } catch {
      /* storage unavailable: fall back to the seed */
    }
    return structuredClone(SEED_DATA);
  }

  async save(data: FamilyData): Promise<void> {
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('could not save locally', e);
      throw e;
    }
  }

  async uploadPhoto(_personId: string, blob: Blob): Promise<string> {
    return blobToDataUrl(blob);
  }

  async uploadFile(_personId: string, blob: Blob, _fileName: string): Promise<string> {
    return blobToDataUrl(blob);
  }

  async reset(): Promise<FamilyData> {
    try {
      localStorage.removeItem(DATA_KEY);
    } catch {
      /* ignore */
    }
    return structuredClone(SEED_DATA);
  }
}
