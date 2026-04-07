import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// ---------------- 路径配置 ----------------
const PATHS = {
    workspace: path.join(__dirname, 'memory'),
    brain: path.join(__dirname, 'memory', 'brain'),
    indexes: path.join(__dirname, 'memory', 'indexes'),
    server: path.join(__dirname, 'apps', 'server', 'http-server.ts'),
    dashboard: path.join(__dirname, 'apps', 'dashboard')
};
// ---------------- 启动信息 ----------------
console.clear();
console.log("\x1b[36m%s\x1b[0m", "==========================================================");
console.log("\x1b[32m%s\x1b[0m", "🟢  BOOTING GLIDE (MOUSE BRAIN) ENVIRONMENT");
console.log("\x1b[36m%s\x1b[0m", "==========================================================");
// ---------------- 自检函数 ----------------
function runHealthCheck() {
    console.log("[Kernel] Running pre-flight checks...");
    const requiredDirs = [PATHS.brain, PATHS.indexes];
    requiredDirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            console.warn(`[Warning] Missing directory: ${dir}. AI might lack context.`);
        }
        else {
            const files = fs.readdirSync(dir).length;
            console.log(`[Check] ${path.basename(dir)}: OK (${files} assets found)`);
        }
    });
    try {
        const models = execSync('ollama list', { encoding: 'utf8' });
        const lines = models.trim().split('\n');
        const modelCount = lines.length > 1 ? lines.length - 1 : 0;
        console.log(`[Ollama] Detected ${modelCount} active models.`);
    }
    catch (e) {
        console.error("[Ollama] Error: Ollama is not running or not in PATH.");
    }
}
// ---------------- 启动服务函数 ----------------
const activeProcesses = [];
function startService(name, command, args, options) {
    const isWin = process.platform === 'win32';
    let finalCommand = command;
    let finalArgs = args;
    if (isWin) {
        finalCommand = `${command} ${args.join(' ')}`;
        finalArgs = [];
    }
    const proc = spawn(finalCommand, finalArgs, {
        ...options,
        stdio: 'inherit',
        shell: true
    });
    proc.on('error', (err) => {
        console.error(`[${name}] Failed to start:`, err);
    });
    activeProcesses.push(proc);
    console.log(`[Kernel] \x1b[34m${name}\x1b[0m service initiated.`);
}
// ---------------- 执行 ----------------
runHealthCheck();
// 启动后端
startService('Backend', 'npx', ['tsx', `"${PATHS.server}"`], {});
// 延迟启动前端
setTimeout(() => {
    startService('Frontend', 'npm', ['run', 'dev-dashboard'], { cwd: PATHS.dashboard });
}, 1500);
// ---------------- 生命周期管理 ----------------
process.on('SIGINT', () => {
    console.log("\n\x1b[31m%s\x1b[0m", "🔴  SHUTTING DOWN GLIDE...");
    activeProcesses.forEach((proc) => {
        if (process.platform === 'win32' && proc.pid) {
            try {
                execSync(`taskkill /pid ${proc.pid} /f /t`, { stdio: 'ignore' });
            }
            catch { }
        }
        else {
            proc.kill();
        }
    });
    setTimeout(() => {
        console.log("👋  Goodbye.");
        process.exit();
    }, 500);
});
process.on('uncaughtException', (err) => {
    console.error("[Fatal] Uncaught Exception:", err);
});
