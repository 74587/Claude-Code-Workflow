import { useState, useEffect } from 'react';

/**
 * Generic hook for managing localStorage state with SSR safety
 * @template T The type of value being stored
 * @param key The localStorage key
 * @param defaultValue The default value if not in localStorage
 * @returns [value, setValue] tuple similar to useState
 */
export function useLocalStorage<T>(key: string, defaultValue: T): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(defaultValue);

  // Load value from localStorage on mount (for SSR safety)
  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        setStoredValue(JSON.parse(item));
      }
    } catch (error) {
      console.warn(`Failed to load localStorage key "${key}":`, error);
    }
  }, [key]);

  // Update localStorage when value changes
  const setValue = (value: T) => {
    try {
      setStoredValue(value);
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`Failed to set localStorage key "${key}":`, error);
    }
  };

  // Return storedValue immediately (it will be hydrated after effect runs)
  return [storedValue, setValue];
}
