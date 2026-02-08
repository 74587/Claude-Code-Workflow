import { useState, useCallback, useRef } from 'react';
import { useIntl } from 'react-intl';
import { useTheme } from '@/hooks/useTheme';
import { useUnsplashSearch } from '@/hooks/useUnsplashSearch';
import { triggerUnsplashDownload, uploadBackgroundImage } from '@/lib/unsplash';
import type { UnsplashPhoto } from '@/lib/unsplash';
import type { BackgroundMode } from '@/types/store';

const MODES: { value: BackgroundMode; labelId: string }[] = [
  { value: 'gradient-only', labelId: 'theme.background.mode.gradientOnly' },
  { value: 'image-only', labelId: 'theme.background.mode.imageOnly' },
  { value: 'image-gradient', labelId: 'theme.background.mode.imageGradient' },
];

/**
 * BackgroundImagePicker Component
 * Allows users to search Unsplash, pick a background image,
 * adjust visual effects, and switch between background modes.
 */
export function BackgroundImagePicker() {
  const { formatMessage } = useIntl();
  const {
    backgroundConfig,
    setBackgroundMode,
    setBackgroundImage,
    updateBackgroundEffect,
  } = useTheme();

  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [customUrl, setCustomUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, isError, error } = useUnsplashSearch(searchQuery, page);

  const showImageControls = backgroundConfig.mode !== 'gradient-only';

  const handlePhotoSelect = useCallback(async (photo: UnsplashPhoto) => {
    setBackgroundImage(photo.regularUrl, {
      photographerName: photo.photographer,
      photographerUrl: photo.photographerUrl,
      photoUrl: photo.photoUrl,
    });
    // Trigger download event per Unsplash API guidelines
    triggerUnsplashDownload(photo.downloadLocation).catch(() => {});
  }, [setBackgroundImage]);

  const handleCustomUrlApply = useCallback(() => {
    if (customUrl.trim()) {
      setBackgroundImage(customUrl.trim(), null);
      setCustomUrl('');
    }
  }, [customUrl, setBackgroundImage]);

  const handleRemoveImage = useCallback(() => {
    setBackgroundImage(null, null);
  }, [setBackgroundImage]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset file input so the same file can be re-selected
    e.target.value = '';

    setUploadError(null);

    if (file.size > 10 * 1024 * 1024) {
      setUploadError(formatMessage({ id: 'theme.background.fileTooLarge' }));
      return;
    }

    if (!file.type.startsWith('image/') || !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setUploadError(formatMessage({ id: 'theme.background.invalidType' }));
      return;
    }

    setIsUploading(true);
    try {
      const result = await uploadBackgroundImage(file);
      setBackgroundImage(result.url, null);
    } catch (err) {
      setUploadError((err as Error).message || formatMessage({ id: 'theme.background.uploadError' }));
    } finally {
      setIsUploading(false);
    }
  }, [formatMessage, setBackgroundImage]);

  return (
    <div className="space-y-4">
      {/* Section title */}
      <h3 className="text-sm font-medium text-text">
        {formatMessage({ id: 'theme.background.title' })}
      </h3>

      {/* Background mode selector */}
      <div
        className="flex gap-2"
        role="radiogroup"
        aria-label={formatMessage({ id: 'theme.background.title' })}
      >
        {MODES.map(({ value, labelId }) => (
          <button
            key={value}
            onClick={() => setBackgroundMode(value)}
            role="radio"
            aria-checked={backgroundConfig.mode === value}
            className={`
              flex-1 px-3 py-2 rounded-lg text-xs font-medium
              transition-all duration-200 border-2
              ${backgroundConfig.mode === value
                ? 'border-accent bg-surface shadow-md'
                : 'border-border bg-bg hover:bg-surface'
              }
              focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2
            `}
          >
            {formatMessage({ id: labelId })}
          </button>
        ))}
      </div>

      {/* Image selection area */}
      {showImageControls && (
        <div className="space-y-3">
          {/* Current image preview */}
          {backgroundConfig.imageUrl && (
            <div className="relative rounded-lg overflow-hidden border border-border">
              <img
                src={backgroundConfig.imageUrl}
                alt="Current background"
                className="w-full h-32 object-cover"
              />
              <button
                onClick={handleRemoveImage}
                className="absolute top-2 right-2 px-2 py-1 text-xs bg-black/60 text-white rounded hover:bg-black/80 transition-colors"
              >
                {formatMessage({ id: 'theme.background.removeImage' })}
              </button>
              {/* Unsplash attribution */}
              {backgroundConfig.attribution && (
                <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/50 text-white text-xs">
                  Photo by{' '}
                  <a
                    href={`${backgroundConfig.attribution.photographerUrl}?utm_source=ccw&utm_medium=referral`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    {backgroundConfig.attribution.photographerName}
                  </a>{' '}
                  on{' '}
                  <a
                    href="https://unsplash.com/?utm_source=ccw&utm_medium=referral"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Unsplash
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Search box */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            placeholder={formatMessage({ id: 'theme.background.searchPlaceholder' })}
            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-bg text-text
              focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
          />

          {/* Photo grid */}
          {isLoading && (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 border-border border-t-accent rounded-full animate-spin" />
            </div>
          )}

          {isError && (
            <p className="text-xs text-destructive py-2">
              {(error as Error)?.message || formatMessage({ id: 'theme.background.searchError' })}
            </p>
          )}

          {data && data.photos.length > 0 && (
            <>
              <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                {data.photos.map((photo) => (
                  <button
                    key={photo.id}
                    onClick={() => handlePhotoSelect(photo)}
                    className={`
                      relative rounded overflow-hidden border-2 transition-all
                      hover:border-accent focus:outline-none focus:ring-2 focus:ring-accent
                      ${backgroundConfig.imageUrl === photo.regularUrl
                        ? 'border-accent ring-2 ring-accent'
                        : 'border-transparent'
                      }
                    `}
                  >
                    <img
                      src={photo.thumbUrl}
                      alt={`Photo by ${photo.photographer}`}
                      className="w-full h-20 object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>

              {/* Pagination */}
              {data.totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-2 py-1 text-xs rounded border border-border disabled:opacity-50 hover:bg-surface"
                  >
                    {formatMessage({ id: 'theme.background.prev' })}
                  </button>
                  <span className="text-xs text-text-secondary">
                    {page} / {data.totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                    disabled={page >= data.totalPages}
                    className="px-2 py-1 text-xs rounded border border-border disabled:opacity-50 hover:bg-surface"
                  >
                    {formatMessage({ id: 'theme.background.next' })}
                  </button>
                </div>
              )}
            </>
          )}

          {data && data.photos.length === 0 && searchQuery.trim() && (
            <p className="text-xs text-text-secondary py-2 text-center">
              {formatMessage({ id: 'theme.background.noResults' })}
            </p>
          )}

          {/* Custom URL input */}
          <div className="flex gap-2">
            <input
              type="url"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder={formatMessage({ id: 'theme.background.customUrlPlaceholder' })}
              className="flex-1 px-3 py-2 text-xs rounded-lg border border-border bg-bg text-text
                focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
            />
            <button
              onClick={handleCustomUrlApply}
              disabled={!customUrl.trim()}
              className="px-3 py-2 text-xs rounded-lg bg-accent text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              {formatMessage({ id: 'theme.background.apply' })}
            </button>
          </div>

          {/* Upload local image */}
          <div className="space-y-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full px-3 py-2 text-xs rounded-lg border border-dashed border-border
                bg-bg text-text hover:bg-surface hover:border-accent
                disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {isUploading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-border border-t-accent rounded-full animate-spin" />
                  {formatMessage({ id: 'theme.background.uploading' })}
                </>
              ) : (
                formatMessage({ id: 'theme.background.upload' })
              )}
            </button>
            {uploadError && (
              <p className="text-xs text-destructive">{uploadError}</p>
            )}
          </div>
        </div>
      )}

      {/* Effects panel */}
      {showImageControls && (
        <div className="space-y-3 pt-2 border-t border-border">
          <h4 className="text-xs font-medium text-text-secondary">
            {formatMessage({ id: 'theme.background.effects' })}
          </h4>

          {/* Blur slider */}
          <div className="space-y-1">
            <div className="flex justify-between">
              <label className="text-xs text-text">
                {formatMessage({ id: 'theme.background.blur' })}
              </label>
              <span className="text-xs text-text-secondary">{backgroundConfig.effects.blur}px</span>
            </div>
            <input
              type="range"
              min="0"
              max="20"
              step="1"
              value={backgroundConfig.effects.blur}
              onChange={(e) => updateBackgroundEffect('blur', Number(e.target.value))}
              className="w-full accent-[hsl(var(--accent))]"
            />
          </div>

          {/* Darken slider */}
          <div className="space-y-1">
            <div className="flex justify-between">
              <label className="text-xs text-text">
                {formatMessage({ id: 'theme.background.darken' })}
              </label>
              <span className="text-xs text-text-secondary">{backgroundConfig.effects.darkenOpacity}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="80"
              step="1"
              value={backgroundConfig.effects.darkenOpacity}
              onChange={(e) => updateBackgroundEffect('darkenOpacity', Number(e.target.value))}
              className="w-full accent-[hsl(var(--accent))]"
            />
          </div>

          {/* Saturation slider */}
          <div className="space-y-1">
            <div className="flex justify-between">
              <label className="text-xs text-text">
                {formatMessage({ id: 'theme.background.saturation' })}
              </label>
              <span className="text-xs text-text-secondary">{backgroundConfig.effects.saturation}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="200"
              step="5"
              value={backgroundConfig.effects.saturation}
              onChange={(e) => updateBackgroundEffect('saturation', Number(e.target.value))}
              className="w-full accent-[hsl(var(--accent))]"
            />
          </div>

          {/* Frosted glass checkbox */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={backgroundConfig.effects.enableFrostedGlass}
              onChange={(e) => updateBackgroundEffect('enableFrostedGlass', e.target.checked)}
              className="w-4 h-4 rounded border-border text-accent focus:ring-2 focus:ring-accent focus:ring-offset-2"
            />
            <span className="text-sm text-text">
              {formatMessage({ id: 'theme.background.frostedGlass' })}
            </span>
          </label>

          {/* Grain checkbox */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={backgroundConfig.effects.enableGrain}
              onChange={(e) => updateBackgroundEffect('enableGrain', e.target.checked)}
              className="w-4 h-4 rounded border-border text-accent focus:ring-2 focus:ring-accent focus:ring-offset-2"
            />
            <span className="text-sm text-text">
              {formatMessage({ id: 'theme.background.grain' })}
            </span>
          </label>

          {/* Vignette checkbox */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={backgroundConfig.effects.enableVignette}
              onChange={(e) => updateBackgroundEffect('enableVignette', e.target.checked)}
              className="w-4 h-4 rounded border-border text-accent focus:ring-2 focus:ring-accent focus:ring-offset-2"
            />
            <span className="text-sm text-text">
              {formatMessage({ id: 'theme.background.vignette' })}
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
