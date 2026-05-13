import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TTLCache } from '../src/cache.js';

describe('TTLCache', () => {
    let cache;

    beforeEach(() => {
        vi.useFakeTimers();
        cache = new TTLCache();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should store and retrieve values within TTL', () => {
        cache.set('key', 'value', 1000);
        expect(cache.get('key')).toBe('value');
        expect(cache.has('key')).toBe(true);
    });

    it('should return null after TTL expires', () => {
        cache.set('key', 'value', 1000);
        
        // Advance time by 1001ms
        vi.advanceTimersByTime(1001);
        
        expect(cache.get('key')).toBe(null);
        expect(cache.has('key')).toBe(false);
    });

    it('should evict expired entries on get', () => {
        cache.set('key', 'value', 1000);
        vi.advanceTimersByTime(1001);
        
        expect(cache.get('key')).toBe(null);
        // Internal store should be empty
        expect(cache._store.size).toBe(0);
    });

    it('should respect different TTLs for different keys', () => {
        cache.set('fast', 'data1', 100);
        cache.set('slow', 'data2', 500);

        vi.advanceTimersByTime(200);
        
        expect(cache.get('fast')).toBe(null);
        expect(cache.get('slow')).toBe('data2');

        vi.advanceTimersByTime(400);
        expect(cache.get('slow')).toBe(null);
    });
});
