import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const SKIPPED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.data',
  'coverage',
  'dist',
  '.vercel',
]);

function walk(root, dir = root, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRS.has(entry.name)) walk(root, join(dir, entry.name), out);
    } else {
      out.push(relative(root, join(dir, entry.name)).replaceAll('\\', '/'));
    }
  }
  return out;
}

/**
 * Files that are tracked OR untracked-but-not-ignored (so the guards also protect work that has not been
 * committed yet). Falls back to a directory walk when `cwd` is not a git repository.
 */
export function listRepoFiles(cwd) {
  try {
    return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
      cwd,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .split('\0')
      .filter(Boolean)
      .map((file) => file.replaceAll('\\', '/'));
  } catch {
    return walk(cwd);
  }
}

export function isTestFile(file) {
  return /\.(test|spec)\.[cm]?[tj]sx?$/.test(file);
}
