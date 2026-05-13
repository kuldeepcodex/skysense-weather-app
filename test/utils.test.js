import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounce } from '../src/utils.js';

describe('debounce utility', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should delay function execution', () => {
        const fn = vi.fn();
        const debounced = debounce(fn, 500);

        debounced('test');
        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(499);
        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1);
        expect(fn).toHaveBeenCalledWith('test');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should only execute once for multiple calls within wait period', () => {
        const fn = vi.fn();
        const debounced = debounce(fn, 500);

        debounced(1);
        debounced(2);
        debounced(3);

        vi.advanceTimersByTime(500);
        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith(3);
    });

    it('should be cancellable', () => {
        const fn = vi.fn();
        const debounced = debounce(fn, 500);

        debounced();
        debounced.cancel();

        vi.advanceTimersByTime(500);
        expect(fn).not.toHaveBeenCalled();
    });
});
