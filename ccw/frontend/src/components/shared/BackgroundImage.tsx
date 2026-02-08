import { useState, useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';
import { DEFAULT_BACKGROUND_CONFIG } from '@/lib/theme';
import type { BackgroundConfig } from '@/types/store';

/**
 * BackgroundImage Component
 * Renders background image layer with visual effects (blur, darken, grain, vignette).
 * Positioned behind all content via z-index layering.
 */
export function BackgroundImage() {
  const activeSlotId = useAppStore((s) => s.activeSlotId);
  const themeSlots = useAppStore((s) => s.themeSlots);
  const activeSlot = themeSlots.find((s) => s.id === activeSlotId);
  const config: BackgroundConfig = activeSlot?.backgroundConfig ?? DEFAULT_BACKGROUND_CONFIG;

  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const handleLoad = useCallback(() => {
    setLoaded(true);
    setError(false);
  }, []);

  const handleError = useCallback(() => {
    setError(true);
    setLoaded(false);
  }, []);

  // Reset load state when image URL changes
  const imageUrl = config.imageUrl;
  const [prevUrl, setPrevUrl] = useState(imageUrl);
  if (imageUrl !== prevUrl) {
    setPrevUrl(imageUrl);
    setLoaded(false);
    setError(false);
  }

  // Don't render anything in gradient-only mode
  if (config.mode === 'gradient-only') return null;

  // Don't render if no image URL or image failed to load
  if (!imageUrl || error) return null;

  const { blur, darkenOpacity, saturation } = config.effects;

  const imageStyle: React.CSSProperties = {
    filter: [
      blur > 0 ? `blur(${blur}px)` : '',
      saturation !== 100 ? `saturate(${saturation / 100})` : '',
    ].filter(Boolean).join(' ') || undefined,
    // Scale slightly when blurred to prevent white edges
    transform: blur > 0 ? 'scale(1.05)' : undefined,
  };

  return (
    <>
      {/* Background image layer */}
      <div
        className="bg-image-layer"
        style={{ opacity: loaded ? 1 : 0 }}
      >
        <img
          src={imageUrl}
          alt=""
          role="presentation"
          style={imageStyle}
          onLoad={handleLoad}
          onError={handleError}
          draggable={false}
        />
      </div>

      {/* Darken overlay */}
      {darkenOpacity > 0 && (
        <div
          className="bg-darken-overlay"
          style={{ backgroundColor: `rgba(0, 0, 0, ${darkenOpacity / 100})` }}
        />
      )}

      {/* Grain texture overlay */}
      <div className="bg-grain-overlay" />

      {/* Vignette overlay */}
      <div className="bg-vignette-overlay" />

      {/* Loading spinner (hidden img for preloading) */}
      {!loaded && !error && (
        <div
          className="fixed inset-0 z-[-3] flex items-center justify-center pointer-events-none"
        >
          <div className="w-6 h-6 border-2 border-border border-t-accent rounded-full animate-spin" />
        </div>
      )}
    </>
  );
}
