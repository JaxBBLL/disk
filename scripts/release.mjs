/**
 * 打包发布产物：把 Next standalone 产物、静态资源、启动脚本、pm2 配置、
 * config.json 收拢到 dist/，得到一个可直接拷贝到服务器运行的自包含目录。
 *
 * 运行方式：npm run build（内部会自动调用本脚本）
 */
import { cp, lstat, mkdir, readdir, realpath, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')

/**
 * 递归复制并「解引用」符号链接：把符号链接指向的真实内容复制为目标文件/目录。
 * 直接 fs.cp 在 Windows 下重建符号链接需要管理员权限（EPERM），
 * 且部署到其它机器后符号链接也可能失效，解引用后才是真正的自包含。
 */
async function copyDeref(src, dst) {
  const info = await lstat(src)

  if (info.isSymbolicLink()) {
    const target = await realpath(src).catch(() => null)
    if (target) {
      await copyDeref(target, dst)
    }
    return
  }

  if (info.isDirectory()) {
    await mkdir(dst, { recursive: true })
    const entries = await readdir(src)
    for (const name of entries) {
      await copyDeref(join(src, name), join(dst, name))
    }
    return
  }

  await cp(src, dst)
}

async function main() {
  const standalone = join(root, '.next', 'standalone', 'server.js')

  if (!existsSync(standalone)) {
    console.error('[release] 未找到 .next/standalone/server.js，请先执行 next build')
    process.exit(1)
  }

  // 清理旧的 dist
  await rm(dist, { recursive: true, force: true })
  await mkdir(dist, { recursive: true })

  // 1. 服务端与运行时依赖
  await copyDeref(join(root, '.next', 'standalone'), dist)

  // 2. standalone 不会自动带上静态资源，必须手动补齐
  await mkdir(join(dist, '.next'), { recursive: true })
  await copyDeref(join(root, '.next', 'static'), join(dist, '.next', 'static'))

  if (existsSync(join(root, 'public'))) {
    await copyDeref(join(root, 'public'), join(dist, 'public'))
  }

  // 3. 启动脚本
  await cp(join(root, 'start.mjs'), join(dist, 'start.mjs'))

  // 4. 生成 pm2 部署配置（部署相关文件只在构建产物中生成，开发目录保持干净）
  const ecosystemConfig = `/**
 * PM2 进程配置（由 scripts/release.mjs 生成）
 * 在 dist/ 目录内执行：pm2 start ecosystem.config.cjs
 */
module.exports = {
  apps: [
    {
      name: 'disk',
      script: 'start.mjs',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      time: true,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
}
`
  await writeFile(join(dist, 'ecosystem.config.cjs'), ecosystemConfig)

  // 5. 配置文件（不存在则交给服务端首次启动时自动创建）
  if (existsSync(join(root, 'config.json'))) {
    await cp(join(root, 'config.json'), join(dist, 'config.json'))
  }

  // 6. 最小 package.json（type: module + 启动命令）
  const pkg = {
    name: 'disk',
    version: '1.0.0',
    private: true,
    type: 'module',
    scripts: {
      start: 'node start.mjs',
      'pm2:start': 'pm2 start ecosystem.config.cjs',
      'pm2:stop': 'pm2 stop disk',
      'pm2:restart': 'pm2 restart disk',
      'pm2:reload': 'pm2 reload disk',
      'pm2:logs': 'pm2 logs disk',
      'pm2:status': 'pm2 status'
    }
  }
  await writeFile(join(dist, 'package.json'), JSON.stringify(pkg, null, 2) + '\n')

  console.log('\n[release] 已生成发布目录 dist/')
  console.log('[release] 部署：将 dist/ 拷贝到服务器，在 dist/ 内执行：')
  console.log('           node start.mjs                    # 前台运行')
  console.log('           pm2 start ecosystem.config.cjs    # pm2 守护\n')
}

main().catch((error) => {
  console.error('[release] 失败：', error)
  process.exit(1)
})
