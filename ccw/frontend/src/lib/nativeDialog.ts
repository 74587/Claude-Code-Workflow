/**
 * Native OS dialog helpers
 * Calls server-side endpoints that open system-native file/folder picker dialogs.
 */

export async function selectFolder(initialDir?: string): Promise<string | null> {
  try {
    const res = await fetch('/api/dialog/select-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initialDir }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.cancelled) return null;
    return data.path || null;
  } catch {
    return null;
  }
}

export async function selectFile(initialDir?: string): Promise<string | null> {
  try {
    const res = await fetch('/api/dialog/select-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initialDir }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.cancelled) return null;
    return data.path || null;
  } catch {
    return null;
  }
}
