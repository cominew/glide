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


npx tsx start.ts
