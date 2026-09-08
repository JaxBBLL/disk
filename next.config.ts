import type { NextConfig } from 'next'

/**
 * Next 配置。
 *
 * - serverExternalPackages：archiver / busboy / mime 属于 Node 侧依赖，
 *   交给打包器处理可能破坏其内部的动态 require，保持外部化更稳妥。
 * - output: 'standalone'：产物形态对齐原 dist/ —— 一个自包含目录 + node start.mjs。
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['archiver', 'busboy', 'mime'],
  output: 'standalone'
}

export default nextConfig
