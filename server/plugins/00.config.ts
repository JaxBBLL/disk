import { appConfig } from '../utils/config'
import { getLocalIP } from '../utils/format'

export default defineNitroPlugin(() => {
  // 立即加载并校验配置（缺失时会自动创建 config.json）
  const { dest, hasDel, port } = appConfig()

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
