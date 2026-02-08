/**
 * Unsplash API Client
 * Frontend functions to search Unsplash via the backend proxy.
 */

export interface UnsplashPhoto {
  id: string;
  thumbUrl: string;
  smallUrl: string;
  regularUrl: string;
  photographer: string;
  photographerUrl: string;
  photoUrl: string;
  blurHash: string | null;
  downloadLocation: string;
}

export interface UnsplashSearchResult {
  photos: UnsplashPhoto[];
  total: number;
  totalPages: number;
}

function getCsrfToken(): string | null {
  const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Search Unsplash photos via backend proxy.
 */
export async function searchUnsplash(
  query: string,
  page = 1,
  perPage = 20
): Promise<UnsplashSearchResult> {
  const params = new URLSearchParams({
    query,
    page: String(page),
    per_page: String(perPage),
  });

  const response = await fetch(`/api/unsplash/search?${params}`, {
    credentials: 'same-origin',
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Unsplash search failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Upload a local image as background.
 * Sends raw binary to avoid base64 overhead.
 */
export async function uploadBackgroundImage(file: File): Promise<{ url: string; filename: string }> {
  const headers: Record<string, string> = {
    'Content-Type': file.type,
    'X-Filename': file.name,
  };
  const csrfToken = getCsrfToken();
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  const response = await fetch('/api/background/upload', {
    method: 'POST',
    headers,
    credentials: 'same-origin',
    body: file,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Upload failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Trigger Unsplash download event (required by API guidelines).
 */
export async function triggerUnsplashDownload(downloadLocation: string): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const csrfToken = getCsrfToken();
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  await fetch('/api/unsplash/download', {
    method: 'POST',
    headers,
    credentials: 'same-origin',
    body: JSON.stringify({ downloadLocation }),
  });
}
