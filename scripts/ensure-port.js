const { execSync } = require('child_process');

// Port to ensure is free
const PORT = process.env.PORT || 5173;

function killPortWindows(port) {
  try {
    const cmd = `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess"`;
    const out = execSync(cmd, { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
    if (!out) return;
    const pids = out.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
        console.log(`Killed process ${pid} on port ${port}`);
      } catch (e) {
        // ignore
      }
    }
  } catch (e) {
    // ignore
  }
}

function killPortUnix(port) {
  try {
    const out = execSync(`lsof -ti :${port}`, { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
    if (!out) return;
    const pids = out.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    for (const pid of pids) {
      try {
        process.kill(Number(pid), 'SIGKILL');
        console.log(`Killed process ${pid} on port ${port}`);
      } catch (e) {
        // ignore
      }
    }
  } catch (e) {
    // ignore
  }
}

(function main() {
  try {
    if (process.platform === 'win32') {
      killPortWindows(PORT);
    } else {
      killPortUnix(PORT);
    }
  } catch (e) {
    // noop
  }
})();
