const si = require('systeminformation');
const os = require('node:os');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const exec = promisify(execFile);

async function safe(promise, fallback = null) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Timed out')), 6000); })]);
  } catch { return fallback; } finally { clearTimeout(timer); }
}

function memoryPercent(mem) {
  return mem?.total > 0 ? Math.max(0, Math.min(100, (mem.total - (mem.available ?? mem.free ?? 0)) / mem.total * 100)) : null;
}

function buildChecks(data, services = null) {
  const checks = [];
  const cpu = data.cpu?.load;
  checks.push({ id: 'cpu', title: 'Processor headroom', status: cpu == null ? 'unknown' : cpu >= 90 ? 'warning' : 'ok', summary: cpu == null ? 'CPU measurement unavailable' : `${cpu.toFixed(1)}% CPU utilization in this sample`, detail: 'A snapshot of work across logical processors. Sustained high use matters more than a short spike.', advice: 'Open Processes and sort by CPU to see which applications are busy.', view: 'processes' });
  const mem = memoryPercent(data.memory);
  checks.push({ id: 'memory', title: 'Memory pressure', status: mem == null ? 'unknown' : mem >= 90 ? 'warning' : 'ok', summary: mem == null ? 'Memory measurement unavailable' : `${mem.toFixed(1)}% of physical memory in use`, detail: 'Calculated from total minus available memory. Reclaimable filesystem cache is included in available memory where the OS reports it.', advice: 'Sort Processes by memory and review apps you no longer need.', view: 'processes' });
  const disks = data.disks || [];
  const fullest = [...disks].sort((a,b) => b.use-a.use)[0];
  checks.push({ id: 'disk', title: 'Room to breathe', status: !fullest ? 'unknown' : fullest.use >= 90 ? 'warning' : 'ok', summary: !fullest ? 'Filesystem usage unavailable' : `${fullest.use.toFixed(1)}% used on the fullest visible filesystem`, detail: 'Checks mounted local filesystems exposed to this app. Storage inspection can help you locate large folders.', advice: 'Inspect a folder in Storage before deciding what to move or remove.', view: 'storage' });
  const interfaces = data.network?.interfaces || [];
  const connected = interfaces.some(n => n.operstate === 'up' && (n.ip4 || n.ip6));
  checks.push({ id: 'network', title: 'Network connection', status: data.network?.interfaces == null ? 'unknown' : connected ? 'ok' : 'warning', summary: connected ? 'An active network interface has an IP address' : 'No active interface with an IP address detected', detail: 'Interface state only. This does not prove internet or DNS reachability; no external connectivity probe is sent.', advice: 'Open Network to review detected adapters.', view: 'network' });
  checks.push({ id: 'services', title: 'Background services', status: services?.status ?? 'unknown', summary: services?.summary ?? 'Service health has not been checked', detail: services?.detail ?? 'Run a health check to query failed systemd services on Linux.', advice: 'Inspect a failed unit with your distribution’s service manager. Orbit does not restart services.', view: 'health' });
  if (data.battery?.hasBattery) checks.push({ id: 'battery', title: 'Battery reserve', status: data.battery.percent < 15 && !data.battery.isCharging ? 'warning' : 'ok', summary: `${Math.round(data.battery.percent)}% remaining · ${data.battery.isCharging ? 'charging' : 'on battery'}`, detail: 'Charge level reported by the operating system; this is not a measurement of battery wear.', advice: 'Connect power if you are running low.', view: 'overview' });
  return checks;
}

function publicReport(info, data, checks) {
  // Deliberate allowlist: never include hostnames, users, IPs, process names, mounts or paths.
  return {
    app: 'Orbit', version: '0.1.0', generatedAt: new Date().toISOString(),
    system: { platform: info.platform, distro: info.distro, release: info.release, arch: info.arch, cpu: info.cpu, cores: info.cores, sandboxed: info.sandboxed },
    cpu: data.cpu, memory: data.memory,
    storage: (data.disks || []).map(d => ({ total: d.size, used: d.used, percent: d.use })),
    checks: checks.map(c => ({ id: c.id, status: c.status, title: c.title })),
    scope: info.sandboxed ? 'Sandbox-visible resources; not a complete host report.' : 'Resources visible to the current user.',
    privacy: 'Hostnames, usernames, addresses, paths, process names, and service names omitted.'
  };
}

function createMetrics() {
  let info;
  let cached = null;
  let pending;
  let processPending;
  let processCache;
  let processTime = 0;
  let slowTime = 0;
  let slow = { disks: [], battery: null, interfaces: null };
  let services = null;
  async function system() {
    if (info) return info;
    const [platform, cpu] = await Promise.all([safe(si.osInfo(), {}), safe(si.cpu(), {})]);
    info = { platform: os.platform(), distro: platform.distro || os.type(), release: platform.release || os.release(), kernel: platform.kernel || os.release(), arch: os.arch(), cpu: `${cpu.manufacturer || ''} ${cpu.brand || os.cpus()[0]?.model || 'Unknown processor'}`.trim(), cores: cpu.cores || os.cpus().length, sandboxed: Boolean(process.env.FLATPAK_ID), version: '0.1.0' };
    return info;
  }
  async function collect() {
    const refreshSlow = Date.now() - slowTime > 30000;
    let networkAllowed = true;
    try { os.networkInterfaces(); } catch { networkAllowed = false; }
    const [load, memory, network, extras] = await Promise.all([
      safe(si.currentLoad()), safe(si.mem()), networkAllowed ? safe(si.networkStats()) : null,
      refreshSlow ? Promise.all([safe(si.fsSize(), []), safe(si.battery()), networkAllowed ? safe(si.networkInterfaces()) : null]) : null
    ]);
    if (extras) {
      slowTime = Date.now();
      slow = { disks: extras[0].filter(d => d.size > 0 && !['squashfs', 'tmpfs', 'devtmpfs', 'overlay'].includes(d.type)).map(d => ({ fs: d.fs, type: d.type, mount: d.mount, size: d.size, used: d.used, available: d.available, use: d.use })), battery: extras[1], interfaces: extras[2]?.filter(n => !n.internal).map(n => ({ iface: n.iface, type: n.type, operstate: n.operstate, ip4: n.ip4, ip6: n.ip6, speed: n.speed, default: n.default })) ?? null };
    }
    const stats = network?.filter(n => n.iface !== 'lo' && n.iface !== 'Loopback Pseudo-Interface 1');
    cached = { timestamp: Date.now(), uptime: os.uptime(), cpu: load ? { load: load.currentLoad, cores: load.cpus.map(c => c.load) } : null, memory: memory ? { total: memory.total, available: memory.available, free: memory.free, used: memory.total - memory.available, swapTotal: memory.swaptotal, swapUsed: memory.swapused } : null, disks: slow.disks, battery: slow.battery, network: { interfaces: slow.interfaces, rx: stats ? stats.reduce((sum, n) => sum + Math.max(0, n.rx_sec || 0), 0) : null, tx: stats ? stats.reduce((sum,n) => sum + Math.max(0, n.tx_sec || 0), 0) : null } };
    return cached;
  }
  async function snapshot() {
    if (cached && Date.now() - cached.timestamp < 1500) return cached;
    if (!pending) pending = collect().finally(() => { pending = null; });
    return pending;
  }
  async function processes() {
    if (processCache && Date.now() - processTime < 4000) return processCache;
    if (!processPending) processPending = safe(si.processes()).then(result => {
      if (!result) throw new Error('The operating system did not return a process list.');
      processTime = Date.now();
      processCache = { total: result.all, running: result.running, list: result.list.map(p => ({ pid: p.pid, name: p.name, cpu: p.cpu, memory: p.memRss * 1024, state: p.state })).sort((a,b) => b.cpu-a.cpu).slice(0,400) };
      return processCache;
    }).finally(() => { processPending = null; });
    return processPending;
  }
  async function health() {
    if (os.platform() !== 'linux') services = { status: 'unknown', summary: 'systemd checks are Linux-only', detail: 'CPU, memory, disk, battery and network checks are available on this platform.' };
    else if (process.env.FLATPAK_ID) services = { status: 'unknown', summary: 'Host services are outside this sandbox', detail: 'Flatpak isolates host services and processes. Install the Debian build for wider host visibility.' };
    else {
      try {
        const { stdout } = await exec('systemctl', ['--failed','--no-legend','--plain','--no-pager'], { timeout: 5000, maxBuffer: 256 * 1024, env: { ...process.env, LC_ALL: 'C' } });
        const lines = stdout.trim().split('\n').filter(Boolean);
        services = { status: lines.length ? 'warning' : 'ok', summary: lines.length ? `${lines.length} failed systemd unit(s)` : 'No failed systemd units', detail: lines.length ? lines.slice(0,10).join('\n') : 'The system service manager reported no failed units at scan time.' };
      } catch { services = { status: 'unknown', summary: 'System service manager unavailable', detail: 'systemd may be absent or inaccessible to this user. Service health is unknown.' }; }
    }
    const data = await snapshot();
    return { timestamp: Date.now(), checks: buildChecks(data, services) };
  }
  return { system, snapshot, processes, health, async report() { const result = await health(); return publicReport(await system(), await snapshot(), result.checks); } };
}
module.exports = { createMetrics, memoryPercent, buildChecks, publicReport };
