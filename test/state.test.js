import { describe, it, expect, beforeEach } from 'vitest';
import { toF, fmtTemp, fmtTempOnly, setCurrentUnit } from '../src/state.js';

describe('state module', () => {
    beforeEach(() => {
        // Reset localStorage and current unit before each test
        localStorage.clear();
        setCurrentUnit('C');
    });

    describe('Temperature Conversions', () => {
        it('should correctly convert Celsius to Fahrenheit', () => {
            expect(toF(0)).toBe(32);
            expect(toF(100)).toBe(212);
            expect(toF(-40)).toBe(-40);
            expect(toF(37)).toBe(99); // 37 * 9/5 + 32 = 98.6 -> rounded to 99
        });

        it('should format temperature in Celsius when unit is C', () => {
            setCurrentUnit('C');
            expect(fmtTemp(0)).toBe('0°C');
            expect(fmtTemp(37.4)).toBe('37°C'); // Math.round(37.4) = 37
            
            expect(fmtTempOnly(25)).toBe('25°');
        });

        it('should format temperature in Fahrenheit when unit is F', () => {
            setCurrentUnit('F');
            expect(fmtTemp(0)).toBe('32°F');
            expect(fmtTemp(37)).toBe('99°F');
            
            expect(fmtTempOnly(25)).toBe('77°'); // 25 * 9/5 + 32 = 77
        });
    });
});
