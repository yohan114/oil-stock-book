import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT } from './db.js';
import { httpError } from './util.js';

export const UPLOADS_DIR = path.join(ROOT, 'data', 'uploads');

const EXT = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
const MAX_BYTES = 12 * 1024 * 1024; // 12 MB decoded

/**
 * Save a base64 data-URL image into data/uploads/<subdir>/.
 * Returns the public path (e.g. "/uploads/batteries/ab12.jpg").
 */
export function saveDataUrl(dataUrl, subdir) {
  const m = /^data:([^;]+);base64,(.+)$/s.exec(String(dataUrl || ''));
  if (!m) httpError(400, 'A valid image is required');
  const mime = m[1].toLowerCase();
  const ext = EXT[mime];
  if (!ext) httpError(400, 'Photo must be a JP, PNG, WEBP or GIF image');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length === 0) httpError(400, 'The photo appears to be empty');
  if (buf.length > MAX_BYTES) httpError(400, 'Photo is too large (max 12 MB)');

  const dir = path.join(UPLOADS_DIR, subdir);
  fs.mkdirSync(dir, { recursive: true });
  const name = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(dir, name), buf);
  return `/uploads/${subdir}/${name}`;
}

export function deleteUpload(publicPath) {
  if (!publicPath || !publicPath.startsWith('/uploads/')) return;
  const abs = path.join(UPLOADS_DIR, publicPath.replace('/uploads/', ''));
  // Guard against path traversal — must stay inside UPLOADS_DIR.
  if (path.resolve(abs).startsWith(path.resolve(UPLOADS_DIR))) {
    fs.rm(abs, { force: true }, () => {});
  }
}
