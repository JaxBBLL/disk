# disk-next

基于 Next.js（App Router）+ TypeScript 构建：单进程、单端口、无代理配置，`next build` 后直接 `node` 运行。

## 功能

**文件操作**

- 多文件上传、文件夹上传（保留目录层级）
- 拖拽上传：把文件 / 整个文件夹从资源管理器拖进页面任意位置即可
- 文件下载、文件夹打包下载
- 文件与文件夹删除、重命名、新建文件夹、移动
- 图片、PDF、部分文本文件预览
- 浏览器前进 / 后退、刷新后保持当前目录

**界面**

- 上传按钮悬停展开下拉菜单（上传文件 / 上传文件夹）
- 拖拽时弹出带目标路径的遮罩卡片
- 全局 toast 通知 + 自定义对话框（替换原生 `alert` / `confirm` / `prompt`）
- 上传过程有进度提示；空目录显示可点击的上传引导
- 选中文件后底部浮出批量操作栏（下载 / 移动 / 删除 / 取消选择）
- 列表加载显示骨架屏；修改时间显示相对时间（悬停可看绝对时间）
- 表头点击排序（名称 / 大小 / 修改时间，目录始终在前）
- 深色 / 浅色主题切换，选择持久化到本地

## 快速开始

需要 **Node ≥ 20**（推荐 20/22 LTS）。

```bash
pnpm install
pnpm dev       # 开发，端口读 config.json
pnpm typecheck # 类型检查（tsc --noEmit）
pnpm build     # 构建并打包到 dist/（自包含发布目录）
pnpm start     # 生产运行（读 config.json 的 port，并监听 0.0.0.0）
pnpm test      # 接口冒烟测试（需先启动服务）
```

## 配置文件 config.json

首次启动会自动创建，位于**运行目录**下：

```json
{
  "dest": "./disk", // 根目录，绝对路径或相对运行目录的路径
  "hasDel": true, // 是否允许删除
  "port": 9527 // 端口
}
```

> 端口由 `start.mjs` 读取后注入环境变量再启动 Next；`dest` 会基于运行目录解析，
> 根目录不存在时自动创建，运行中若被删除也会自动重建。

## 构建与部署

`pnpm build` 会构建并打包出一个**自包含的发布目录 `dist/`**，包含运行所需的一切：

```
dist/
├── .next/static/        前端静态资源（standalone 不会自带，由 release 脚本补齐）
├── node_modules/        服务端运行时依赖（已解引用符号链接）
├── public/              favicon / robots.txt
├── server.js            Next standalone 入口
├── start.mjs            启动脚本（读 config.json 端口）
├── ecosystem.config.cjs PM2 配置
├── config.json          运行配置（可改 dest / port / hasDel）
└── package.json         type: module + 启动命令
```

**部署到服务器**：把 `dist/` 整体拷贝到服务器，然后**在 dist 目录内**运行：

```bash
# 方式一：前台运行
cd dist && node start.mjs

# 方式二：PM2 守护（崩溃自动重启）
cd dist && pm2 start ecosystem.config.cjs

# 日常管理
pm2 status            # 查看状态
pm2 logs disk         # 查看日志
pm2 restart disk      # 重启
pm2 stop disk         # 停止
pm2 delete disk       # 移除

# 开机自启（可选）
pm2 save
pm2 startup
```

`dist/` 内的 `package.json` 也提供了 npm 脚本（`npm start`、`npm run pm2:start` 等），
pm2 相关命令只有在构建产物 `dist/` 里才会出现，开发目录保持干净。

> 端口与根目录仍读 `config.json`，修改后执行 `pm2 restart disk` 生效。
> 若用 fnm 管理 Node，启动 PM2 前需保证 node 在 PATH 中（如 `eval "$(fnm env --shell bash)"`）。
> `start.mjs` 以「运行目录」为基准读 config.json 并解析 `dest`，部署到服务器时务必 `cd dist` 后再运行。

## 目录结构（Next.js App Router）

```
app/                    前端 + 路由（遵循 App Router 文件约定）
  layout.tsx            根布局：metadata / viewport + 主题防闪烁脚本 + Toast + AppDialog
  page.tsx              页面入口（Suspense + DiskManager）
  error.tsx             路由级错误边界（'use client' + reset）
  loading.tsx           路由加载态（骨架屏）
  not-found.tsx         404 页面
  favicon.ico           站点图标（文件约定，自动注入 link）
  globals.css           全局样式（由原 index.less 转换）
  api/                  Route Handler，文件路径即接口
    list/route.ts       目录列表 / 搜索（stat 并发、目录优先排序）
    create/route.ts     新建文件夹
    delete/route.ts     删除（幂等，异步 rm）
    rename/route.ts     重命名
    move/route.ts       移动
    upload/route.ts     上传（busboy 流式落盘、中断回滚）
    download/route.ts   下载（单文件直推 / 多文件流式 ZIP）
    download/preview/route.ts 预览
components/             UI 组件（DiskManager 为客户端边界）
  DiskManager.tsx       文件管理器主界面
  FileBreadcrumb / FileTable / ContextMenu / DropZone / MoveDialog /
  ListSkeleton / Transition / Toast / AppDialog / icons.tsx
lib/
  types.ts              前后端共用类型契约（FileItem、ApiResponse…）
  client/               hooks（useFileList、useFileAction、useDrop）、请求、toast/dialog store、浏览器工具
  server/               config / path / fs / format / http（带 server-only 边界保护）
instrumentation.ts      启动钩子：按 NEXT_RUNTIME 分流加载 Node 侧逻辑
instrumentation-node.ts Node 运行时启动逻辑（打印访问地址）
types/archiver.d.ts     archiver v8 的类型补充
scripts/                dev.mjs / release.mjs / smoke.mjs
start.mjs               生产启动脚本
next.config.ts          serverExternalPackages + output: 'standalone'
```

代码约定：全仓库导入统一走 `@/*` 别名；`'use client'` 只出现在客户端边界组件，
纯 hook / 工具模块不携带；`lib/server/*` 顶部 `import 'server-only'`，一旦被客户端
误引用会在构建期直接报错。

## 接口

| 方法 | 路径                                   | 说明                                          |
| ---- | -------------------------------------- | --------------------------------------------- |
| POST | `/api/list`                            | 列表，`body: { name, filePath, isDirectory }` |
| POST | `/api/create`                          | 新建文件夹，`body: { filePath, name }`        |
| POST | `/api/delete`                          | 删除，`body: { filePaths }`，幂等             |
| POST | `/api/rename`                          | 重命名，`body: { filePath, newName }`         |
| POST | `/api/move`                            | 移动，`body: { filePaths, newFolder }`        |
| POST | `/api/upload?filePath=a/b`             | 上传，`multipart/form-data`，字段名 `files`   |
| GET  | `/api/download?filePaths=["a.txt"]`    | 下载，单文件直推，多个打包为 ZIP              |
| GET  | `/api/download/preview?filePath=a.txt` | 预览，`Content-Disposition: inline`           |

所有接口的路径参数都必须经过 `resolveSafe()` 校验，越界一律返回 403。

## TypeScript

服务端与前端全量使用 TypeScript（`strict` 已开启）：

- `lib/types.ts` 是前后端唯一的数据契约（`FileItem` / `ApiResponse` / `ListResult` 等）
- `lib/server/http.ts` 提供基于 `NextResponse` 的 `json / fail / readJson / nodeToWeb / handle`，
  统一替代 Nitro 的 `defineEventHandler / createError / setHeader / sendStream`，
  错误始终以 `{ message }` JSON 返回，前端 `reportError` 取值链路不变
- `start.mjs` 与 `scripts/*.mjs` 是纯 Node 脚本，保持 `.mjs`（无需引入 tsx 即可直接 `node` 运行）
- `archiver` v8 的 `ZipArchive` 具名导出缺类型，在 `types/archiver.d.ts` 中做最小声明
- 文件图标使用 `@baybreezy/file-extension-icon`（自带类型、零依赖），返回 base64 SVG data URI，
  在 `lib/client/fileIcon.ts` 收口，无需引入图标字体样式

## 安全与健壮性

- 所有路径统一经 `resolveSafe()` 校验，拦截 `../` 目录穿越
- 文件名统一校验非法字符；上传文件名剥离路径分隔符
- 下载 / 预览使用 RFC 5987 编码响应头，中文文件名不乱码
- 删除使用异步 `rm`，删除大目录不会阻塞事件循环
- 列表 `stat` 并发执行，大目录下性能更优
- 上传统一按「目标目录」分组合并请求，多文件不会逐文件发请求
- 上传支持客户端中断回滚（all-or-nothing），断开连接后自动清理半成品
- 批次内同名互斥，同一请求上传多个同名文件不会互相覆盖
- 上传响应返回实际落盘名（重名时带序号）
- 删除接口幂等，目标已不存在时返回成功而非 500

## 与原 Nuxt 版的差异（实现层面）

功能、接口、交互、视觉、配置与发布流程完全对齐，仅框架对应关系不同：

| Nuxt 版                | Next 版                                            |
| ---------------------- | -------------------------------------------------- |
| `pages/index.vue`      | `app/page.tsx` + `components/DiskManager.tsx`（`'use client'`） |
| Nitro `server/api/*`   | `app/api/**/route.ts`（`runtime = 'nodejs'`）        |
| `server/plugins/00.config.ts` | 根目录 `instrumentation.ts`                   |
| `#shared/types`        | `lib/types.ts`                                      |
| composables            | `lib/client/*` hooks（语义不变）                    |
| `$fetch`（ofetch）     | `lib/client/request.ts` 的 `apiFetch`               |
| `<Teleport>` / `<Transition>` | `createPortal` / `components/Transition.tsx` |
| `assets/css/index.less`| `app/globals.css`（Less 仅用嵌套，1:1 转纯 CSS）     |
| `.output`              | `.next/standalone`（release 脚本补拷静态资源与 public）|

## 已知取舍

- 页面为客户端渲染（`'use client'` + `dynamic = 'force-dynamic'`），等价原项目的 `ssr: false`：
  这是局域网文件管理器，首屏依赖浏览器 API，关闭 SSR 更简单。
- 包管理器固定为 pnpm（锁文件为 `pnpm-lock.yaml`）。由于 `output: 'standalone'` 会把
  `node_modules` 结构原样搬入 `.next/standalone`，而 Windows 上创建符号链接默认需要管理员权限，
  pnpm 默认的符号链接布局会让 `next build` 以 EPERM 失败，因此 `.npmrc` 里强制
  `node-linker=hoisted`（平铺布局），保证在无特殊权限的 Windows 上也能构建。
- 未做 Docker / 单文件打包，如需可另行添加。

## 冒烟测试

启动服务后运行：

```bash
node scripts/smoke.mjs
# 或指定地址
BASE=http://localhost:3000 node scripts/smoke.mjs
```

覆盖目录操作、中文文件名、上传（含批次内重名与批量）、上传中断回滚、下载（单文件/ZIP）、
预览、以及目录穿越与非法文件名等安全校验，共 38 项。

> 所有测试数据都收敛在 `smoke-root/` 下，运行结束后只删除该目录，可随时安全执行。

## 已知环境注意事项

部分 IDE 会通过 `NODE_OPTIONS` 注入把 Node 的删除操作重定向到回收站的 shim。
**从这个 IDE 内置终端启动服务时，删除文件可能失败或进入回收站**，同时 `next build` 可能因
文件重命名失败而报错。用系统终端正常执行不受影响；若必须在 IDE 终端内构建，可在命令前清除该变量：

```bash
env -u NODE_OPTIONS pnpm build
```
