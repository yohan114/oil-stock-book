import fs from 'node:fs';
import path from 'node:path';
import { db, ROOT } from './db.js';

const BACKUP_DIR = path.join(ROOT, 'data', 'backups');
const MAX_BACKUPS = 30;

export function runBackup() {
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });

    // Generate filename with date suffix (YYYY-MM-DD)
    const dateStr = new Date().toISOString().slice(0, 10);
    const backupFile = path.join(BACKUP_DIR, `oilbook_${dateStr}.db`);

    // Only backup if a backup for today hasn't been created yet
    if (fs.existsSync(backupFile)) {
      return;
    }

    // Safely hot-backup SQLite database using VACUUM INTO
    const escapedPath = backupFile.replace(/'/g, "''");
    db.exec(`VACUUM INTO '${escapedPath}'`);
    console.log(`[Backup] Successfully created daily SQLite backup: ${backupFile}`);

    pruneOldBackups();
  } catch (error) {
    console.error('[Backup] Daily backup failed:', error);
  }
}

function pruneOldBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('oilbook_') && f.endsWith('.db'))
      .map(f => ({
        name: f,
        path: path.join(BACKUP_DIR, f),
        mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs
      }))
      .sort((a, b) => b.mtime - a.mtime); // Newest first

    if (files.length > MAX_BACKUPS) {
      const toDelete = files.slice(MAX_BACKUPS);
      for (const file of toDelete) {
        fs.unlinkSync(file.path);
        console.log(`[Backup] Pruned old backup: ${file.name}`);
      }
    }
  } catch (error) {
    console.error('[Backup] Failed to prune old backups:', error);
  }
}

export function startBackupScheduler() {
  // Run an immediate check on startup
  runBackup();

  // Run the daily check every hour (3600000 milliseconds)
  setInterval(() => {
    runBackup();
  }, 3600000);
}
