// ========================================
// TerminalPanel Component
// ========================================
// Right-side overlay panel for terminal monitoring.
// Follows the IssueDrawer pattern: fixed overlay + translate-x slide animation.
// Contains TerminalNavBar (left icon strip) and TerminalMainArea (main content).
// All state is read from terminalPanelStore - no props needed.

import { useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useTerminalPanelStore } from '@/stores/terminalPanelStore';
import { TerminalNavBar } from './TerminalNavBar';
import { TerminalMainArea } from './TerminalMainArea';

// ========== Component ==========

export function TerminalPanel() {
  const isPanelOpen = useTerminalPanelStore((s) => s.isPanelOpen);
  const closePanel = useTerminalPanelStore((s) => s.closePanel);

  const handleClose = useCallback(() => {
    closePanel();
  }, [closePanel]);

  // ESC key to close
  useEffect(() => {
    if (!isPanelOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isPanelOpen, handleClose]);

  if (!isPanelOpen) {
    return null;
  }

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          'fixed inset-0 bg-black/40 transition-opacity z-40',
          isPanelOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full w-1/2 bg-background border-l border-border shadow-2xl z-50',
          'flex flex-row transition-transform duration-300 ease-in-out',
          isPanelOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Terminal Panel"
        style={{ minWidth: '400px', maxWidth: '800px' }}
      >
        {/* Left navigation bar */}
        <TerminalNavBar />

        {/* Main display area */}
        <TerminalMainArea onClose={handleClose} />
      </div>
    </>
  );
}
