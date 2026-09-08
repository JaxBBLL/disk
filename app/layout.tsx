import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import './globals.css'
import { AppDialog } from '@/components/AppDialog'
import { Toast } from '@/components/Toast'
import { themeBootstrapScript } from '@/lib/client/theme'

export const metadata: Metadata = {
  title: 'disk',
  description: '局域网云盘：上传、下载、预览与文件管理'
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {/*
          必须在首屏渲染前同步应用主题，避免深色模式闪白。
          因此这里只能用内联脚本，不能换成 next/script（它是异步加载的）。
        */}
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body>
        {children}
        <Toast />
        <AppDialog />
      </body>
    </html>
  )
}
