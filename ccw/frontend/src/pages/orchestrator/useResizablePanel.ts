// ========================================
// useResizablePanel Hook
// ========================================
// Provides drag-to-resize functionality for sidebar panels.
// Adapted from cc-wf-studio with Tailwind-friendly approach.

import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_MIN_WIDTH = 200;
const DEFAULT_MAX_WIDTH = 600;
const DEFAULT_WIDTH = 300;
const DEFAULT_STORAGE_KEY = 'ccw-orchestrator.panelWidth';

interface UseResizablePanelOptions {
  minWidth?: number;
  maxWidth?: number;
  defaultWidth?: number;
  storageKey?: string;
  /** Direction of drag relative to panel growth. 'left' means dragging left grows the panel (right-side panel). */
  direction?: 'left' | 'right';
}

interface UseResizablePanelReturn {
  width: number;
  isResizing: boolean;
  handleMouseDown: (e: React.MouseEvent) => void;
}

/**
 * Custom hook for resizable panel functionality.
 *
 * Features:
 * - Drag-to-resize with mouse events
 * - Configurable min/max width constraints
 * - localStorage persistence
 * - Prevents text selection during drag
 */
export function useResizablePanel(options?: UseResizablePanelOptions): UseResizablePanelReturn {
  const minWidth = options?.minWidth ?? DEFAULT_MIN_WIDTH;
  const maxWidth = options?.maxWidth ?? DEFAULT_MAX_WIDTH;
  const defaultWidth = options?.defaultWidth ?? DEFAULT_WIDTH;
  const storageKey = options?.storageKey ?? DEFAULT_STORAGE_KEY;
  const direction = options?.direction ?? 'right';

  // Initialize width from localStorage or use default
  const [width, setWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = Number.parseInt(saved, 10);
        if (!Number.isNaN(parsed) && parsed >= minWidth && parsed <= maxWidth) {
          return parsed;
        }
      }
    } catch {
      // localStorage unavailable
    }
    return defaultWidth;
  });

  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);

  // Handle mouse move during resize
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const deltaX = e.clientX - startXRef.current;
      // For 'right' direction (left panel), dragging right grows the panel
      // For 'left' direction (right panel), dragging left grows the panel
      const newWidth = direction === 'right'
        ? startWidthRef.current + deltaX
        : startWidthRef.current - deltaX;

      const constrainedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
      setWidth(constrainedWidth);
    },
    [minWidth, maxWidth, direction]
  );

  // Handle mouse up to end resize
  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  // Handle mouse down to start resize
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      startXRef.current = e.clientX;
      startWidthRef.current = width;
    },
    [width]
  );

  // Set up global mouse event listeners
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      // Prevent text selection during drag
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'ew-resize';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // Persist width to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, width.toString());
    } catch {
      // localStorage unavailable
    }
  }, [width, storageKey]);

  return {
    width,
    isResizing,
    handleMouseDown,
  };
}
