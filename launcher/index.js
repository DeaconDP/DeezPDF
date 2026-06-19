#!/usr/bin/env node

import { spawn, execSync } from 'child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  statSync,
} from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'net';
import { platform } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const LOCK_FILE = join(ROOT, '.deezpdfreader.lock');
const LOG_DIR = join(ROOT, 'logs');
const LOG_FILE = join(LOG_DIR, 'app.log');
const DEFAULT_PORT = 5173;

function log(level, message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level}] ${message}\n`;
  if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
  try {
    writeFileSync(LOG_FILE, line, { flag: 'a' });
  } catch {
    // ignore log write failures
  }
  console.log(`[DeezPDF:${level}] ${message}`);
}

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function killProcess(pid) {
  try {
    if (platform() === 'win32') {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
    } else {
      process.kill(pid, 'SIGTERM');
      setTimeout(() => {
        try {
          process.kill(pid, 'SIGKILL');
        } catch {
          // already dead
        }
      }, 2000);
    }
    log('INFO', `Killed previous instance (PID ${pid})`);
  } catch {
    log('WARN', `Could not kill PID ${pid}`);
  }
}

function readLockFile() {
  if (!existsSync(LOCK_FILE)) return null;
  try {
    const content = readFileSync(LOCK_FILE, 'utf-8').trim();
    const [pidStr, portStr, vitePidStr] = content.split(':');
    return {
      pid: parseInt(pidStr, 10),
      port: parseInt(portStr, 10),
      vitePid: parseInt(vitePidStr, 10),
    };
  } catch {
    return null;
  }
}

function writeLockFile(port, vitePid) {
  writeFileSync(LOCK_FILE, `${process.pid}:${port}:${vitePid}`);
}

function removeLockFile() {
  try {
    if (existsSync(LOCK_FILE)) unlinkSync(LOCK_FILE);
  } catch {
    // ignore
  }
}

function handleExistingInstance() {
  const lock = readLockFile();
  if (!lock) return;

  if (lock.pid && isProcessRunning(lock.pid)) {
    log('INFO', 'Existing instance found, shutting it down...');
    if (lock.vitePid && isProcessRunning(lock.vitePid)) {
      killProcess(lock.vitePid);
    }
    killProcess(lock.pid);
    sleep(1000);
  }
  removeLockFile();
}

function sleep(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    // busy wait for sync startup
  }
}

function checkNode() {
  try {
    const version = execSync('node --version', { encoding: 'utf-8' }).trim();
    log('INFO', `Node.js ${version} detected`);
    return true;
  } catch {
    console.error('\n[DeezPDF:ERROR] ERR-LCH-001: Node.js is not installed.');
    console.error('Download from https://nodejs.org\n');
    log('ERROR', 'ERR-LCH-001: Node.js not found');
    return false;
  }
}

function needsInstall() {
  if (!existsSync(join(ROOT, 'node_modules'))) return true;
  const pkgStat = statSync(join(ROOT, 'package.json')).mtimeMs;
  const lockPath = join(ROOT, 'node_modules', '.package-lock.json');
  if (!existsSync(lockPath)) return true;
  const lockStat = statSync(lockPath).mtimeMs;
  return pkgStat > lockStat;
}

function runNpmInstall() {
  log('INFO', 'Installing dependencies...');
  console.log('Installing dependencies, please wait...\n');
  try {
    execSync('npm install', { cwd: ROOT, stdio: 'inherit' });
    writeFileSync(join(ROOT, 'node_modules', '.package-lock.json'), Date.now().toString());
    log('INFO', 'Dependencies installed');
  } catch (err) {
    log('ERROR', `npm install failed: ${err.message}`);
    process.exit(1);
  }
}

function findFreePort(startPort, maxPort = startPort + 20) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', () => {
      if (startPort < maxPort) {
        findFreePort(startPort + 1, maxPort).then(resolve).catch(reject);
      } else {
        reject(new Error('ERR-LCH-002'));
      }
    });
    server.listen(startPort, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

function startVite(port) {
  const isWin = platform() === 'win32';
  const viteBin = join(ROOT, 'node_modules', '.bin', isWin ? 'vite.cmd' : 'vite');

  const child = spawn(viteBin, ['--host', '127.0.0.1', '--port', String(port)], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: isWin,
    detached: !isWin,
  });

  child.stdout?.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) log('DEBUG', msg);
  });

  child.stderr?.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) log('DEBUG', msg);
  });

  return child;
}

function waitForServer(port, maxAttempts = 30) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      attempts++;
      import('http')
        .then(({ get }) => {
          get(`http://127.0.0.1:${port}`, (res) => {
            res.resume();
            resolve();
          }).on('error', () => {
            if (attempts >= maxAttempts) {
              reject(new Error('ERR-LCH-002: Server failed to start'));
            } else {
              setTimeout(check, 500);
            }
          });
        })
        .catch(reject);
    };
    setTimeout(check, 1000);
  });
}

function findBrowser() {
  const isWin = platform() === 'win32';
  const isMac = platform() === 'darwin';

  const candidates = [];

  if (isWin) {
    candidates.push(
      join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    );
  } else if (isMac) {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    );
  }

  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  return null;
}

function openBrowser(port) {
  const url = `http://127.0.0.1:${port}`;
  const browserPath = findBrowser();
  const isWin = platform() === 'win32';
  const isMac = platform() === 'darwin';

  log('INFO', `Opening browser at ${url}`);

  if (browserPath) {
    const args = isWin
      ? [`--app=${url}`]
      : [`--app=${url}`, '--new-window'];

    const browser = spawn(browserPath, args, {
      detached: true,
      stdio: 'ignore',
    });
    browser.unref();
    log('INFO', `Launched app mode browser (PID ${browser.pid})`);
    return browser.pid;
  }

  // Fallback to system open
  if (isMac) {
    execSync(`open "${url}"`);
  } else if (isWin) {
    execSync(`start "" "${url}"`, { shell: true });
  } else {
    execSync(`xdg-open "${url}"`);
  }
  return null;
}

function minimizeTerminal() {
  if (platform() === 'win32') {
    try {
      execSync(
        'powershell -Command "(Add-Type -MemberDefinition \'[DllImport(\\"user32.dll\\")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);\' -Name Win32 -Namespace Console -PassThru)::ShowWindow((Get-Process -Id $PID).MainWindowHandle, 6)"',
        { stdio: 'ignore' }
      );
    } catch {
      // ignore
    }
  }
}

function watchBrowserAndShutdown(browserPid, viteProcess) {
  if (!browserPid) {
    log('INFO', 'No browser PID to watch; press Ctrl+C to stop');
    process.on('SIGINT', () => shutdown(viteProcess));
    process.on('SIGTERM', () => shutdown(viteProcess));
    return;
  }

  const interval = setInterval(() => {
    if (!isProcessRunning(browserPid)) {
      clearInterval(interval);
      log('INFO', 'Browser closed, shutting down...');
      shutdown(viteProcess);
    }
  }, 2000);

  process.on('SIGINT', () => {
    clearInterval(interval);
    shutdown(viteProcess);
  });
}

function shutdown(viteProcess) {
  log('INFO', 'Shutting down DeezPDF Reader');
  if (viteProcess && !viteProcess.killed) {
    try {
      if (platform() === 'win32') {
        execSync(`taskkill /PID ${viteProcess.pid} /T /F`, { stdio: 'ignore' });
      } else {
        process.kill(-viteProcess.pid, 'SIGTERM');
      }
    } catch {
      viteProcess.kill();
    }
  }
  removeLockFile();
  process.exit(0);
}

async function main() {
  log('INFO', 'DeezPDF Reader launcher starting');
  handleExistingInstance();

  if (!checkNode()) {
    process.exit(1);
  }

  if (needsInstall()) {
    runNpmInstall();
  }

  let port;
  try {
    port = await findFreePort(DEFAULT_PORT);
  } catch {
    console.error('\n[DeezPDF:ERROR] ERR-LCH-002: Could not find an available port.\n');
    log('ERROR', 'ERR-LCH-002: Port bind failed');
    process.exit(1);
  }

  const viteProcess = startVite(port);
  writeLockFile(port, viteProcess.pid);

  try {
    await waitForServer(port);
  } catch (err) {
    log('ERROR', err.message);
    shutdown(viteProcess);
    process.exit(1);
  }

  log('INFO', `Server running on port ${port}`);
  minimizeTerminal();

  const browserPid = openBrowser(port);
  watchBrowserAndShutdown(browserPid, viteProcess);
}

main().catch((err) => {
  log('ERROR', err.message);
  process.exit(1);
});
