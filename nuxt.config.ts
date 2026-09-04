import { readFileSync } from 'node:fs'
import { join } from 'node:path'

interface ConfigFile {
  dest?: string
  hasDel?: boolean
  port?: number
}

function readAppConfig(): Partial<ConfigFile> {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), 'config.json'), 'utf-8')) as Partial<ConfigFile>
  } catch {
    return {}
  }
}

const { port } = readAppConfig()

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  // 局域网文件管理器，首屏全部依赖浏览器 API，使用 SPA 模式最简单可靠
  ssr: false,

  // 本项目没有 routeRules / 预渲染需求，关闭 appManifest。
  // 同时规避一个已知的启动竞态：从 nuxt build 切回 nuxt dev 时，
  // .nuxt 里是生产态 manifest，Vite 预解析 #app-manifest 会报
  // "Failed to resolve import #app-manifest"（随后会自愈但很吵）。
  experimental: {
    appManifest: false
  },

  css: ['file-icons-js/css/style.css', '@/assets/css/index.less'],

  app: {
    head: {
      title: 'disk',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' }
      ]
    }
  },

  devServer: {
    port: Number(port) || 3000
  },

  vite: {
    css: {
      preprocessorOptions: {
        less: { javascriptEnabled: true }
      }
    }
  },

  typescript: {
    strict: true
  }
})
