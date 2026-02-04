/**
 * Unit tests for colorGenerator module
 * Tests HSL theme generation algorithm and output validation
 */

import { describe, it, expect } from 'vitest';
import { generateThemeFromHue, getVariableCount, isValidHue } from './colorGenerator';

describe('colorGenerator', () => {
  describe('generateThemeFromHue', () => {
    it('should generate object with 40+ keys for light mode', () => {
      const result = generateThemeFromHue(180, 'light');
      const keys = Object.keys(result);

      expect(keys.length).toBeGreaterThanOrEqual(40);
    });

    it('should generate object with 40+ keys for dark mode', () => {
      const result = generateThemeFromHue(180, 'dark');
      const keys = Object.keys(result);

      expect(keys.length).toBeGreaterThanOrEqual(40);
    });

    it('should return values in "H S% L%" format', () => {
      const result = generateThemeFromHue(180, 'light');
      const hslPattern = /^\d+(\.\d+)?\s+\d+(\.\d+)?%\s+\d+(\.\d+)?%$/;

      Object.values(result).forEach(value => {
        expect(value).toMatch(hslPattern);
      });
    });

    it('should generate high lightness values for light mode backgrounds', () => {
      const result = generateThemeFromHue(180, 'light');

      // Parse lightness from --bg variable
      const bgLightness = parseInt(result['--bg'].split(' ')[2]);
      expect(bgLightness).toBeGreaterThan(85);

      // Parse lightness from --surface variable
      const surfaceLightness = parseInt(result['--surface'].split(' ')[2]);
      expect(surfaceLightness).toBeGreaterThan(85);
    });

    it('should generate low lightness values for dark mode backgrounds', () => {
      const result = generateThemeFromHue(180, 'dark');

      // Parse lightness from --bg variable
      const bgLightness = parseInt(result['--bg'].split(' ')[2]);
      expect(bgLightness).toBeLessThan(22);

      // Parse lightness from --surface variable
      const surfaceLightness = parseInt(result['--surface'].split(' ')[2]);
      expect(surfaceLightness).toBeLessThan(22);
    });

    it('should use provided hue in generated variables', () => {
      const testHue = 240;
      const result = generateThemeFromHue(testHue, 'light');

      // Check primary hue-based variables
      const accentHue = parseInt(result['--accent'].split(' ')[0]);
      expect(accentHue).toBe(testHue);

      const primaryHue = parseInt(result['--primary'].split(' ')[0]);
      expect(primaryHue).toBe(testHue);
    });

    it('should handle edge case: hue = 0', () => {
      const result = generateThemeFromHue(0, 'light');

      expect(Object.keys(result).length).toBeGreaterThanOrEqual(40);
      expect(result['--accent']).toMatch(/^0\s+\d+%\s+\d+%$/);
    });

    it('should handle edge case: hue = 360', () => {
      const result = generateThemeFromHue(360, 'light');

      expect(Object.keys(result).length).toBeGreaterThanOrEqual(40);
      // 360 should normalize to 0
      expect(result['--accent']).toMatch(/^0\s+\d+%\s+\d+%$/);
    });

    it('should handle negative hue values by normalizing', () => {
      const result = generateThemeFromHue(-60, 'light');

      // -60 should normalize to 300
      const accentHue = parseInt(result['--accent'].split(' ')[0]);
      expect(accentHue).toBe(300);
    });

    it('should handle hue values > 360 by normalizing', () => {
      const result = generateThemeFromHue(450, 'light');

      // 450 should normalize to 90
      const accentHue = parseInt(result['--accent'].split(' ')[0]);
      expect(accentHue).toBe(90);
    });

    it('should generate different themes for light and dark modes', () => {
      const lightTheme = generateThemeFromHue(180, 'light');
      const darkTheme = generateThemeFromHue(180, 'dark');

      // Background should be different
      expect(lightTheme['--bg']).not.toBe(darkTheme['--bg']);

      // Text should be different
      expect(lightTheme['--text']).not.toBe(darkTheme['--text']);
    });

    it('should include all essential CSS variables', () => {
      const result = generateThemeFromHue(180, 'light');

      const essentialVars = [
        '--bg',
        '--surface',
        '--border',
        '--text',
        '--text-secondary',
        '--accent',
        '--primary',
        '--secondary',
        '--muted',
        '--success',
        '--warning',
        '--error',
        '--info',
        '--destructive',
        '--hover'
      ];

      essentialVars.forEach(varName => {
        expect(result).toHaveProperty(varName);
      });
    });

    it('should generate complementary secondary colors', () => {
      const testHue = 180;
      const result = generateThemeFromHue(testHue, 'light');

      // Secondary should use complementary hue (180 degrees offset)
      const secondaryHue = parseInt(result['--secondary'].split(' ')[0]);
      const expectedComplementary = (testHue + 180) % 360;
      expect(secondaryHue).toBe(expectedComplementary);
    });

    it('should have consistent variable count across different hues', () => {
      const hue1 = generateThemeFromHue(0, 'light');
      const hue2 = generateThemeFromHue(120, 'light');
      const hue3 = generateThemeFromHue(240, 'light');

      expect(Object.keys(hue1).length).toBe(Object.keys(hue2).length);
      expect(Object.keys(hue2).length).toBe(Object.keys(hue3).length);
    });

    it('should have consistent variable count across modes', () => {
      const lightCount = Object.keys(generateThemeFromHue(180, 'light')).length;
      const darkCount = Object.keys(generateThemeFromHue(180, 'dark')).length;

      expect(lightCount).toBe(darkCount);
    });
  });

  describe('getVariableCount', () => {
    it('should return count of generated variables', () => {
      const count = getVariableCount();
      expect(count).toBeGreaterThanOrEqual(40);
    });

    it('should return consistent count', () => {
      const count1 = getVariableCount();
      const count2 = getVariableCount();
      expect(count1).toBe(count2);
    });
  });

  describe('isValidHue', () => {
    it('should return true for valid hue values', () => {
      expect(isValidHue(0)).toBe(true);
      expect(isValidHue(180)).toBe(true);
      expect(isValidHue(360)).toBe(true);
      expect(isValidHue(450)).toBe(true);
      expect(isValidHue(-60)).toBe(true);
    });

    it('should return false for NaN', () => {
      expect(isValidHue(NaN)).toBe(false);
    });

    it('should return false for Infinity', () => {
      expect(isValidHue(Infinity)).toBe(false);
      expect(isValidHue(-Infinity)).toBe(false);
    });

    it('should return false for non-number types', () => {
      expect(isValidHue('180' as any)).toBe(false);
      expect(isValidHue(null as any)).toBe(false);
      expect(isValidHue(undefined as any)).toBe(false);
    });
  });
});
