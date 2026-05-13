import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchWeather } from '../src/api.js';
import { appCache } from '../src/cache.js';

describe('api module - fetchWeather', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        appCache.clear();
        localStorage.clear();
    });

    it('should call onData with weather data on success', async () => {
        const mockData = {
            location: { name: 'London', country: 'UK' },
            current: { temp_c: 20 }
        };

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => mockData,
            headers: new Map()
        }));

        const onData = vi.fn();
        const onStart = vi.fn();

        await fetchWeather('London', { onData, onStart });

        expect(onStart).toHaveBeenCalled();
        expect(onData).toHaveBeenCalledWith(mockData);
    });

    it('should call onError when city is not found (400)', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: 400,
            json: async () => ({ error: { message: 'No matching location found.' } }),
            headers: new Map()
        }));

        const onError = vi.fn();

        await fetchWeather('InvalidCity', { onError });

        expect(onError).toHaveBeenCalledWith('City not found. Try a different name.');
    });

    it('should call onError with specific message on 403 quota exceeded', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: 403,
            headers: new Map()
        }));

        const onError = vi.fn();

        await fetchWeather('NewLondon', { onError }); // Use different name to be safe

        expect(onError).toHaveBeenCalledWith('API quota reached. Try again later.');
    });

    it('should abort previous requests if a new one is started', async () => {
        const onData1 = vi.fn();
        const onData2 = vi.fn();

        vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url, options) => {
            // Simulate a delay
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Check if aborted
            if (options.signal.aborted) {
                const err = new Error('Aborted');
                err.name = 'AbortError';
                throw err;
            }

            return {
                ok: true,
                json: async () => ({ location: { name: url.includes('London') ? 'London' : 'Paris' } }),
                headers: new Map()
            };
        }));

        // Start first fetch
        const p1 = fetchWeather('London', { onData: onData1 });
        // Start second fetch shortly after
        await new Promise(resolve => setTimeout(resolve, 10));
        const p2 = fetchWeather('Paris', { onData: onData2 });

        await Promise.all([p1, p2]);

        expect(onData1).not.toHaveBeenCalled(); // Should have been aborted
        expect(onData2).toHaveBeenCalled(); // Should succeed
    });
});
