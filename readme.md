# disk

一个简单的局域网云盘，用于局域网内传输文件。

基于 Nuxt 4（Nitro）+ TypeScript 构建：单进程、单端口、无代理配置，`nuxt build` 后直接 `node` 运行。

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
pnpm typecheck # 类型检查（vue-tsc）
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

> 端口由 `start.mjs` 读取后注入环境变量再启动 Nitro；`dest` 会基于运行目录解析，
> 根目录不存在时自动创建，运行中若被删除也会自动重建。

## 构建与部署

`pnpm build` 会构建并打包出一个**自包含的发布目录 `dist/`**，包含运行所需的一切：

```
dist/
├── .output/              服务端 + 静态资源（含运行时依赖，已解引用符号链接）
├── start.mjs             启动脚本（读 config.json 端口）
├── ecosystem.config.cjs  PM2 配置
├── config.json           运行配置（可改 dest / port / hasDel）
└── package.json          type: module + 启动命令
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

## 目录结构（Nuxt 4）

```
app/                    前端源码（Nuxt 4 默认 srcDir）
  app.vue               根布局：<NuxtPage /> + Toast + AppDialog
  pages/index.vue       主页面
  components/           FileBreadcrumb、FileTable、MoveDialog、ContextMenu、DropZone、Toast、AppDialog
  composables/          useFileList、useFileAction、useDrop、useSelectAll、useToast、useDialog
  plugins/              theme.client.ts（主题初始化）
  utils/                浏览器端工具（文件选择、拖拽收集、下载、错误提示、防抖 ref、相对时间）
  assets/css/index.less 样式
server/                 服务端（留在根目录）
  api/                  文件路由即接口，无需手动注册
    list.post.ts        目录列表 / 搜索（stat 并发、目录优先排序）
    create.post.ts      新建文件夹
    delete.post.ts      删除（幂等，异步 rm）
    rename.post.ts      重命名
    move.post.ts        移动
    upload.post.ts      上传（busboy 流式落盘、中断回滚）
    download.get.ts     下载（单文件直推 / 多文件流式 ZIP）
    download/preview.get.ts  预览
  plugins/00.config.ts  启动时加载配置并打印访问地址
  utils/                config / path / fs / format
shared/types/           前后端共用类型契约（FileItem、ApiResponse…）与第三方包类型声明
scripts/smoke.mjs       接口冒烟测试
```

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

- `#shared/types` 是前后端唯一的数据契约（`FileItem` / `ApiResponse` / `ListResult` 等），
  Nuxt 4 的 `shared/` 目录对 app 与 server 双向可见
- 组件统一 `<script setup lang="ts">`，props / emits / model 均使用泛型声明
- `start.mjs` 与 `scripts/*.mjs` 是纯 Node 脚本，保持 `.mjs`（无需引入 tsx 即可直接 `node` 运行）
- `file-icons-js` 无类型、`archiver` v8 的 `ZipArchive` 具名导出缺类型，均在 `shared/types/*.d.ts` 中做最小声明

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

## 已知取舍

- `ssr: false`（SPA）。这是局域网文件管理器，首屏依赖浏览器 API，关闭 SSR 更简单；
  如需 SSR，把 `nuxt.config.ts` 的 `ssr` 改回 `true` 并对 `file-icons-js` 相关代码加 `<ClientOnly>`。
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
**从这个 IDE 内置终端启动服务时，删除文件可能失败或进入回收站**，同时 `nuxt build` 清理构建缓存会报
`[safe-delete] 操作失败`。用系统终端正常执行不受影响；若必须在 IDE 终端内构建，可在命令前清除该变量：

```bash
env -u NODE_OPTIONS pnpm build
```
