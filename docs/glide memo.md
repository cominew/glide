进入 Glide 目录

PS D:\glide> cd D:\glide

批量创建目录 ⭐

PS D:\glide> mkdir kernel,runtime,skills,memory,apps,tools,docs,experiments


    Directory: D:\glide


Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
d-----          4/4/2026   9:39 AM                kernel
d-----          4/4/2026   9:39 AM                runtime
d-----          4/4/2026   9:39 AM                skills
d-----          4/4/2026   9:39 AM                memory
d-----          4/4/2026   9:39 AM                apps
d-----          4/4/2026   9:39 AM                tools
d-----          4/4/2026   9:39 AM                docs
d-----          4/4/2026   9:39 AM                experiments

创建子目录

PS D:\glide> mkdir memory\indexes,memory\conversations,memory\loaders


    Directory: D:\glide\memory


Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
d-----          4/4/2026   9:41 AM                indexes
d-----          4/4/2026   9:41 AM                conversations
d-----          4/4/2026   9:41 AM                loaders


PS D:\glide> mkdir runtime\semantic,runtime\orchestrator


    Directory: D:\glide\runtime


Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
d-----          4/4/2026   9:41 AM                semantic
d-----          4/4/2026   9:41 AM                orchestrator


PS D:\glide> mkdir apps\server,apps\dashboard


    Directory: D:\glide\apps


Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
d-----          4/4/2026   9:41 AM                server
d-----          4/4/2026   9:41 AM                dashboard


PS D:\glide> tree "D:\glide" /f | Select-Object -First 100
Folder PATH listing for volume Data
Volume serial number is B473-CF7C
D:\GLIDE
├───apps
│   │   .gitkeep
│   │
│   ├───dashboard
│   └───server
├───docs
│       .gitkeep
│       glide memo.md
│
├───experiments
│       .gitkeep
│
├───kernel
│       .gitkeep
│
├───memory
│   │   .gitkeep
│   │
│   ├───conversations
│   ├───indexes
│   └───loaders
├───runtime
│   │   .gitkeep
│   │
│   ├───orchestrator
│   └───semantic
├───skills
│       .gitkeep
│
└───tools

防止 Git 忽略空文件夹,放一个占位文件。

Get-ChildItem -Directory | ForEach-Object {
    New-Item "$($_.FullName)\.gitkeep" -ItemType File
}

PS D:\glide> Get-ChildItem -Directory | ForEach-Object {
>>     New-Item "$($_.FullName)\.gitkeep" -ItemType File
>> }


    Directory: D:\glide\apps


Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a----          4/4/2026   9:42 AM              0 .gitkeep


    Directory: D:\glide\docs


Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a----          4/4/2026   9:42 AM              0 .gitkeep


    Directory: D:\glide\experiments


Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a----          4/4/2026   9:42 AM              0 .gitkeep


    Directory: D:\glide\kernel


Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a----          4/4/2026   9:42 AM              0 .gitkeep


    Directory: D:\glide\memory


Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a----          4/4/2026   9:42 AM              0 .gitkeep


    Directory: D:\glide\runtime


Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a----          4/4/2026   9:42 AM              0 .gitkeep


    Directory: D:\glide\skills


Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a----          4/4/2026   9:42 AM              0 .gitkeep


    Directory: D:\glide\tools


Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a----          4/4/2026   9:42 AM              0 .gitkeep


然后对子目录：

Get-ChildItem -Recurse -Directory | ForEach-Object {
    New-Item "$($_.FullName)\.gitkeep" -ItemType File -ErrorAction SilentlyContinue
}

PS D:\glide> Get-ChildItem -Recurse -Directory | ForEach-Object {
>>     New-Item "$($_.FullName)\.gitkeep" -ItemType File -ErrorAction SilentlyContinue
>> }


    Directory: D:\glide\apps\dashboard


Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a----          4/4/2026   9:47 AM              0 .gitkeep


    Directory: D:\glide\apps\server


Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a----          4/4/2026   9:47 AM              0 .gitkeep


    Directory: D:\glide\memory\conversations


Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a----          4/4/2026   9:47 AM              0 .gitkeep


    Directory: D:\glide\memory\indexes


Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a----          4/4/2026   9:47 AM              0 .gitkeep


    Directory: D:\glide\memory\loaders


Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a----          4/4/2026   9:47 AM              0 .gitkeep


    Directory: D:\glide\runtime\orchestrator


Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a----          4/4/2026   9:47 AM              0 .gitkeep


    Directory: D:\glide\runtime\semantic


Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a----          4/4/2026   9:47 AM              0 .gitkeep


在 D:\glide 下创建：
New-Item .env -ItemType File
New-Item .env.example -ItemType File

写一个 适合 Glide v0.1 的 .gitignore，覆盖现在的技术栈：

Node.js + npm / pnpm / yarn
TypeScript
Vite + React
Ollama 本地向量/缓存文件
系统临时文件


前端依赖（Dashboard）
cd apps/dashboard
npm install

后端依赖（Express server）
cd ../../apps/server
npm install express dotenv

工具 / 脚本依赖
cd ../../tools
npm install fs-extra axios

配置 .env


cd D:\glide\apps\dashboard
初始化 Node 项目
npm init -y

安装 Vite + React 依赖：
npm install react react-dom
npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom
npm i -D @types/cors

启动 Express Server
cd apps/server
ts-node http-server.ts

新建更新D://glide/start.ts

安装缺失依赖 cors

在 D:\glide\apps\server 目录下执行：

npm install cors

如果你想把这些常用后端依赖都一次装齐，可以：

npm install express cors dotenv

Invoke-RestMethod -Uri http://localhost:3001/api/chat -Method Post -ContentType "application/json" -Body '{"message":"Hello"}'

安装缺少的包：
powershellcd D:\glide\apps\dashboard
npm install recharts @tailwindcss/vite tailwindcss
npm install lucide-react
npm install framer-motion

安装缺失依赖（可选，如果以后要重新提取客户数据）
bash
cd D:\glide
npm install xlsx pdfjs-dist mammoth
npm install pdf-parse

马上可以做：

✅ AI 自动 Dashboard
✅ CRM 图表
✅ 客户画像卡片
✅ Sales Insight 动态动画

创建 Memory 目录
mkdir D:\glide\memory
mkdir D:\glide\memory\brain
mkdir D:\glide\memory\indexes

重新生成 Customers Index
tsx D:\glide\tools\extract-contacts.ts
成功后必须出现：
D:\glide\memory\indexes\customers\customers.json

重建 Knowledge Index ⭐⭐⭐⭐⭐

执行：

D:\glide\tools\build-knowledge-index.ts
tsx D:\glide\tools\build-knowledge-index.ts

成功后应该出现：

memory/indexes/knowledge/
   chunks.json
   embeddings.json

Glide v1  ❌  single reply
Glide v2  ✅  planner + multi skills
Glide v3  ✅  execution timeline
Glide v4  ✅  aggregator synthesis

# 安装 Python 和依赖
pip install googletrans==4.0.0-rc1 markdown

# 创建翻译脚本 translate.py

安装 Python 3.7+ 以及 googletrans 库：

bash
pip install googletrans==4.0.0-rc1

将 translate.py 放在项目根目录 D:\glide\ 下，然后在该目录下运行命令：

bash
python translate.py

glide/
├── constitution/           # 第一层：宪法（不可变，需人工审核修改）
│   ├── identity.md         # 角色定义
│   ├── safety.md           # 安全边界
│   ├── decision.md         # 决策原则
│   └── memory.md           # 记忆策略
│
├── policy/                 # 第二层：策略（可变，可由 Agent 或用户调整）
│   ├── privacy.md          # 数据隐私等级（public/internal/confidential）
│   ├── auto_approve.md     # 自动执行白名单（如“查询类操作无需审批”）
│   ├── priority.md         # 任务优先级规则（如“客户请求 > 内部任务”）
│   └── retry.md            # 重试策略（最大次数、间隔）
│
├── knowledge/              # 第三层：知识（静态事实）
│   ├── business/           # 业务领域
│   ├── project/            # 项目架构
│   ├── user/               # 用户偏好
│   ├── decisions/          # 历史决策记录
│   └── failures/           # 失败案例
│
├── skills/                 # 第四层：技能（代码）
│   └── *.skill.ts
│
├── runtime/                # 第五层：运行时（动态状态）
│   ├── orchestrator/
│   ├── tasks/              # 任务持久化
│   └── agent.ts
│
└── memory/                 # 保留（结构化索引）
    └── indexes/


knowledge/
├── _MANIFEST.md
├── business/
│   ├── customers/
│   ├── products/
│   ├── marketing.md
│   └── support.md
├── project/
│   ├── architecture.md      # 系统架构描述
│   ├── roadmap.md           # 开发路线图
│   └── adr.md               # 架构决策记录（重命名后）
├── user/
│   ├── charles.md
│   └── sessions/
├── decisions/               # Agent 运行时决策（自动生成）
├── failures/                # 失败案例（自动生成）
├── skills/                  # 技能元数据
│   ├── _META_customer.md
│   ├── _META_sales.md
│   └── ...
└── _archive/                # 归档

Glide Kernel
│
├── Scheduler        ⭐ AI CPU（NEW）
│
├── ConsciousLoop    → 思考
├── GoalEngine       → 行动
├── HealthMonitor    → 体检
└── EventBus         → 神经系统

🧠 AI OS 的真正原则（非常关键）

真正 AI OS 有三个大脑层：

层	作用	是否允许执行
Conscious	Awareness	❌
Reflect	Observe	❌
Plan	Decide	⚠️
Execute	Act	✅

目标架构（Glide AI OS Boot）
start.ts
   ↓
Boot Kernel
   ↓
Start ConsciousLoop
   ↓
Start Scheduler
   ↓
Start HTTP Server
   ↓
System Alive

✔️ 正确启动顺序（Glide OS 标准）
1. KernelState
2. EventBus
3. Registry
4. LLM
5. Orchestrator
6. ConsciousLoop
7. GoalEngine
8. Scheduler
9. Server
10. Frontend

正确模型：

🧠 思考

👉 Orchestrator.think()

🧭 决策（plan）

👉 Orchestrator.plan()

⚙️ 审批（policy）

👉 PolicyEngine.validatePlan()

🚀 任务执行

👉 Orchestrator.execute()

📦 任务发布

👉 GoalEngine.emit(goal)

🔁 反馈

👉 EventBus

🧾 反省

👉 Orchestrator.reflect()

🧠 学习

👉 recordExperience()

🧬 自我修正

👉 future：policy + memory + reflection loop

🧠 正确架构


🔵 Scheduler（唯一 CPU）

控制节奏

🟢 GoalEngine（任务层）

控制“做什么”

🟣 Orchestrator（智能层）

控制“怎么做”

🟡 ConsciousLoop（观察层）

👉 只能做：

reflect（低频）
health observation
memory hint generation

❌ 不能做：

tick driver
task trigger
execution control

                USER
                  │
                  ▼
            Orchestrator
                  │
      ┌───────────┼───────────┐
      ▼           ▼           ▼
   Working     Episodic     Semantic
   Memory      Memory        Memory
   (short)     (events)      (knowledge)

 Runtime
↓
Memory
↓
Reflection
↓
Learning
↓
RAG
↓
Self Evolution  

Runtime
↓
EventStream
↓
Memory
↓
Reflection (offline)
↓
Learning (batch)
↓
RAG index update
↓
Policy update (NOT runtime)

全新系统结构
                    ┌──────────────┐
                    │   Scheduler   │  ← OS Clock (唯一驱动)
                    └──────┬───────┘
                           │ ticks
                           ▼
                ┌────────────────────┐
                │     TaskQueue      │  ← CPU Queue
                └────────┬───────────┘
                         ▼
        ┌────────────────────────────────┐
        │        Orchestrator Pool       │  ← Workers (stateless)
        └────────┬───────────┬──────────┘
                 ▼           ▼
          Skill Engine   Reflection Daemon
                 │
                 ▼
        ┌────────────────────┐
        │     EventBus       │  ← single data backbone
        └────────┬───────────┘
                 ▼
     Memory (Working / Episodic / Semantic)
                 ▼
            Frontend Stream

                 ┌──────────────┐
                 │  Scheduler   │  ← ONLY CLOCK (唯一控制流)
                 └──────┬───────┘
                        ▼
                ┌──────────────┐
                │  GoalEngine  │  ← Task Generation
                └──────┬───────┘
                        ▼
                ┌──────────────┐
                │ Orchestrator │  ← Execution Planner
                └──────┬───────┘
                        ▼
                ┌──────────────┐
                │ Skill Layer   │  ← Tools / Agents
                └──────┬───────┘
                        ▼
                ┌──────────────┐
                │   EventBus   │  ← SINGLE STATE STREAM
                └──────┬───────┘
                        ▼
        ┌──────────────────────────────┐
        │ Memory System (3-layer)      │
        └──────────────────────────────┘
                        ▼
                ConsciousLoop (Observer ONLY)

🚀 正确 Runtime Flow
Scheduler tick
   ↓
GoalEngine.generate()
   ↓
GoalQueue
   ↓
Orchestrator.plan(goal)
   ↓
Skill execution
   ↓
EventBus emit
   ↓
Memory write
   ↓
ConsciousLoop observe (async only)

Memory 层 ✔️


Working Memory     → runtime context
Episodic Memory    → event log
Semantic Memory    → embeddings / RAG

✔️ 标准 cognitive architecture

系统运行逻辑变成：
UI input
   ↓
eventBus(ui:input)
   ↓
TaskRouter
   ↓
task:create
   ↓
WorkerPool
   ↓
Orchestrator
   ↓
task:done
   ↓
memory:write
   ↓
reflection (async later)

glide/
│
├── kernel/        ← AI OS Kernel（不可污染）
├── runtime/       ← Execution Runtime
├── cognition/     ← Thinking / Reflection
├── memory/        ← Memory System
├── knowledge/     ← Knowledge OS
├── skills/        ← Capability Layer
├── apps/          ← Interfaces
├── constitution/  ← Identity
├── policy/        ← Governance
└── tools/         ← Dev utilities

统一 3 条宪法级原则：

✅ 1️⃣ Event Driven Only
✅ 2️⃣ Scheduler = 唯一 CPU

只有 Scheduler 能：

驱动系统
推进时间
触发执行

其他全部 被动。
✅ 3️⃣ ConsciousLoop 永远不能控制系统

它：

✔ 观察
✔ 反思
✔ 建议


Event Producers
      ↓
EventBus
      ↓
Dispatcher ⭐⭐⭐
      ↓
Governance Layer ⭐⭐⭐
 (Constitution + Human Approval)
      ↓
TaskRouter
      ↓
Orchestrator (execution only)
      ↓
Memory + State Broadcast
      ↓
Cognition (observer only)



                 Event Producers
                         │
                         ▼
                    EventBus
                         │
                         ▼
                    Dispatcher
                         │
                         ▼
              ┌─────────────────┐
              │ Governance Layer│
              │ Constitution    │
              │ Human Approval  │
              └────────┬────────┘
                       ▼
                   TaskRouter
                       ▼
                  Orchestrator
                       ▼
                 Tool / Agents
                       ▼
                     Events
                       ▼
              Memory + State Store
                       ▼
                 ConsciousLoop
                   (Observer)


🧠 完整 Thinking Model（工程版）
INTENT LAYER
────────────────
GoalEngine → generates goals

CONSTRAINT LAYER
────────────────
PolicyEngine → validates safety & rules
Constitution → global immutable rules

EXECUTION LAYER
────────────────
Orchestrator → executes steps

GENERATIVE LAYER
────────────────
LLM → reasoning + generation

OBSERVATION LAYER
────────────────
ConsciousLoop → monitors & reflects

Kernel      → nervous system
Dispatcher  → traffic control
Runtime     → muscles
Cognition   → awareness
Governance  → law
Memory      → brain storage

knowledge = canonical truth
index     = disposable derivative

知识 = 正则真理

索引 = 可抛弃的衍生品

knowledge/

📚 图书馆原书

indexes/

📖 图书馆目录卡

memory/

🧠 读者笔记

🧠 Glide 分层（最终稳定认知）
constitution → law
governance   → authority
cognition    → thinking
runtime      → execution
kernel       → system
knowledge    → world facts
memory       → experience
indexes      → acceleration
tools        → offline evolution

🧠 对应 Cognitive Science
Glide	大脑类比
conversations	episodic memory
experiences	reinforcement learning
knowledge	semantic memory
indexes	hippocampus indexing
cognition	prefrontal cortex

Architecture Activation（架构激活）
⭐ OS Bring-Up Phase
STEP 1 — Authority Map⚠️ 
| Layer      | 能做什么             | 不能做什么  |
| ---------- | ---------------- | ------ |
| Kernel     | broadcast events | 不决策    |
| Dispatcher | routing & gating | 不思考    |
| Runtime    | execute          | 不判断合法性 |
| Cognition  | evaluate         | 不执行    |
| Governance | veto             | 不执行    |
| Human      | final authority  | —      |

STEP 2 — Event Flow Freeze（第二步）

确定唯一执行路径：

Event Producer
      ↓
EventBus
      ↓
Dispatcher
      ↓
Policy Gate
      ↓
Human Gate
      ↓
TaskQueue
      ↓
Runtime
      ↓
Memory Write
      ↓
Cognition Observe

⚠️ 不允许任何 bypass。

STEP 3 — Directory Alignment（现在才轮到文件）

这时才：

✅ 移文件
✅ 改 import
✅ 修 TS error
✅ 删除旧结构

✅ Glide OS — Layer Contract
1. INTENT LAYER — Why something should happen
意图层——为什么应该发生某事
一句话：产生“想做什么”
2. CONSTRAINT LAYER — What is allowed
一句话：决定“能不能做”
3. ROUTING LAYER ⭐
一句话：决定“走哪条路”
4. EXECUTION LAYER — How it happens
执行层——它是如何发生的
一句话：负责“真正去做”
5. GENERATIVE LAYER — Thinking engine
生成层——思维引擎
一句话：只负责“思考”，没有权力。
6. OBSERVATION LAYER — Self-awareness
观察层——自我意识
一句话：系统的“意识”，不是行动者。
7. MEMORY LAYER — What was lived
记忆层——曾经的生活
规则：
Memory NEVER self-writes.
Only approved execution writes memory.
8. KERNEL LAYER — Physics of the OS
内核层——操作系统物理学
一句话：宇宙规律。

🧠 kernel（现实层）

“发生了什么”

event truth
state snapshot
time tick
registry
🧭 governance（规则层）

“允许什么”

approve / deny
constraints
human gate
policy
🧠 cognition（理解层）

“这意味着什么”

reflection
learning
evaluation
self-evolution
⚙️ runtime（执行层）

“做什么”

orchestrator
executor
skills
aggregation
📡 dispatcher（流转层）

“发给谁”

✅ Glide OS Thinking Types
GoalEngine      → Desire Thinking
PolicyEngine    → Ethical Thinking
Dispatcher      → Routing Thinking
Orchestrator    → Procedural Thinking
LLM             → Generative Thinking
ConsciousLoop   → Meta Thinking
Memory          → Experiential Thinking
Kernel          → Physical Reality

当前 runtime

D:\GLIDE\RUNTIME
│   agent.ts
│
├───execution
│       aggregator.ts
│       executor.ts
│       orchestrator.ts
│       ui-log.ts
│
├───goals
│       goal-engine.ts
│
├───tasks
│       task-queue.ts
│       task.ts
│
├───tracing
│       event-trace.ts
│       execution-trace.ts
│       trace.ts
│
├───utils
│       safe-json.ts
│
└───worker
        worker-pool.ts
        worker.ts


INTENT
  ↓
GoalEngine

AUTHORITY ⭐⭐⭐
  ↓
Dispatcher
   ├── policy-gate
   ├── human-gate
   └── task-router


EXECUTION (NO AUTHORITY)
  ↓
Runtime
   ├── orchestrator
   ├── executor
   └── workers

Event Flow
Event Producer
────────────────
UI
Scheduler Tick
Memory Write
Reflection
External API
Human Action

        ↓

EventBus  (broadcast only)

        ↓

Dispatcher  ⭐ AUTHORITY INTERRUPT HANDLER
   ├ policy-gate
   ├ human-gate
   └ task-router

        ↓

TaskQueue

        ↓

Runtime Execution

Temporal Event 属于：

⭐ SYSTEM PRIMITIVE（系统原语）

⭐ Temporal Layer（时间语义层）

它负责：

event 生命周期
event 状态流转
event 优先级演化
event 是否允许执行
event 是否需要 human approval
event 是否进入 memory / cognition

Glide Authority Stack（最终形态）
HUMAN            ← Absolute Authority
   │
CONSTITUTION     ← Immutable Law
   │
POLICY ENGINE    ← Operational Rules
   │
DISPATCHER       ← Authority Executor
   │
ORCHESTRATOR     ← Execution Only
   │
SKILLS


npx tsx start.ts

npm run dev
