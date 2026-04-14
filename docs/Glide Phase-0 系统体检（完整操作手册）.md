✅ Glide Phase-0 系统体检（完整操作手册）

按顺序执行，不要跳。

① TypeScript 静态健康检查（第一关）
运行
npx tsc --noEmit
✅ 理想结果
(no output)

= 100% 编译通过

❌ 常见问题
1️⃣ 找不到 node 类型

如果看到：

Cannot find name 'process'
Cannot find module 'child_process'

修复：

npm i -D @types/node

然后确认：

"types": ["node"]

在 tsconfig.json.

2️⃣ 旧 import

例如：

no exported member 'llmLock'

说明：

👉 旧 ConsciousLoop 时代残留

修法：

llmLock → runtimeLocks.llm
🎯 目标

👉 TS = 0 errors

这是 Kernel 级要求。

② 启动测试（Runtime Smoke Test）

运行：

npm run start

观察终端。

✅ 必须看到

类似：

[Kernel] Booting...
[EventBus] Ready
[Server] Listening
❌ 绝对不能出现
❌ 无限打印
thinking...
thinking...
thinking...

= event loop bug。

❌ 卡死不返回 prompt

= lock 未释放。

❌ CPU 飙升

= 自触发 event。

③ 最关键检查 —— Lock 是否泄漏

你现在最大风险：

RuntimeLock 永久锁死。

在 runtime-lock.ts 临时加日志
acquire(): boolean {
  console.log('[LOCK] acquire attempt');

  if (this.locked) {
    console.log('[LOCK] already locked');
    return false;
  }

  this.locked = true;
  console.log('[LOCK] acquired');
  return true;
}

release() {
  this.locked = false;
  console.log('[LOCK] released');
}
然后：

发送一次 query。

✅ 正确输出
[LOCK] acquired
...
[LOCK] released
❌ 如果没有 released

说明：

某条执行路径提前 return

这是 AI 系统最常见致命 bug。

④ EventBus 健康检查

打开：

kernel/event-bus.ts

在 emit 加：

console.log('[EVENT]', type);

发送一次 query。

正常情况
EVENT: ui:query
EVENT: task:start
EVENT: answer:start
EVENT: answer:end
EVENT: task:end
❌ 危险情况
无限循环
EVENT: task:start
EVENT: task:start
EVENT: task:start

说明：

👉 event handler 又 emit 同类事件。

= OS 死循环。

⑤ Orchestrator 生命周期检查（超重要）

检查 orchestrator.execute()。

每一个出口必须：
runtimeLocks.llm.release();
kernelState.set('IDLE');

包括：

no steps
error
cancel
timeout
normal end
⭐ 推荐终极写法（避免未来 bug）
try {
   ...
}
finally {
   runtimeLocks.llm.release();
   kernelState.set('IDLE');
}

99% AI 项目死在这里。

⑥ Memory 写入检查

检查：

memory/experiences

执行一次任务后：

✅ 应新增文件。

如果没有：

说明：

recordExperience 没执行

= Learning 断了。

⑦ Dashboard 可观测检查

打开 Dashboard。

确认：

你能看到

✅ 实时事件
✅ answer streaming
✅ task 完成
✅ 没假日志

如果 UI 在动但 backend 没 event：

👉 fake UI。

这是 AI 产品大忌。

⑧ Idle 状态恢复（很多人忽略）

完成任务后：

系统必须：

Kernel State = IDLE

否则 Scheduler 未来无法工作。

打印：

console.log(kernelState.get());

检查。