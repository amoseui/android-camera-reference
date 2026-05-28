import MiniSearch from 'minisearch';
import type { AcrefData } from './loader.js';

export interface SearchHit {
  id: string;
  score: number;
}

export function createSearchIndex(data: AcrefData): MiniSearch {
  const idx = new MiniSearch({
    fields: ['id', 'displayName', 'tags'],
    storeFields: ['id'],
    extractField: (doc, field) => {
      const v = (doc as Record<string, unknown>)[field];
      return typeof v === 'string' ? v : Array.isArray(v) ? v.join(' ') : '';
    },
  });
  idx.addAll(Object.values(data.nodes) as Array<{ id: string }>);
  return idx;
}

export function search(idx: MiniSearch, query: string): SearchHit[] {
  return idx
    .search(query)
    .slice(0, 50)
    .map((r) => ({ id: r.id as string, score: r.score }));
}
