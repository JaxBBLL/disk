import { existsSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { appConfig } from '../utils/config'
import { getLocalIP } from '../utils/format'

export default defineNitroPlugin(() => {
  // 立即加载并校验配置（缺失时会自动创建 config.json）
  const { dest, hasDel, port } = appConfig()

  // 清理上一次启动遗留的 .upload-tmp/ 孤儿目录：
  // 服务端会话状态仅存在内存 map 中，重启后 map 清空，磁盘上的临时目录
  // 与之失去关联——既无法被前端通过 uploadId 引用，也无法被 merge 触发清理。
  // 启动时一次性清空等价于"放弃所有未完成的上传"，对 LAN 场景足够稳妥。
  cleanupOrphanUploadTmp(join(dest, '.upload-tmp'))

  // Nitro 2.13 起不再触发 listen 钩子，改为在插件加载时直接输出
  const runningPort = process.env.NITRO_PORT || process.env.PORT || port
  const ip = getLocalIP().find((item) => item.startsWith('192')) || 'localhost'

  console.log('')
  console.log(`[disk] 根目录     ${dest}`)
  console.log(`[disk] 删除权限   ${hasDel ? '开启' : '关闭'}`)
  console.log(`[disk] Local      http://localhost:${runningPort}`)
  console.log(`[disk] Network    http://${ip}:${runningPort}`)
  console.log('')
})

/**
 * 删除 .upload-tmp 下的所有子目录；目录不存在时静默忽略。
 * 每个会话目录 {uploadId} 是分片上传的临时空间，全部清掉等价于"放弃所有未完成上传"。
 */
function cleanupOrphanUploadTmp(dir: string): void {
  if (!existsSync(dir)) {
    return
  }
  let removed = 0
  for (const entry of readdirSync(dir)) {
    rmSync(join(dir, entry), { recursive: true, force: true })
    removed += 1
  }
  if (removed > 0) {
    console.log(`[disk] 已清理 ${removed} 个遗留的分片上传临时目录`)
  }
}
