/* eslint-disable no-undef */
const path = require('path')
const express = require('express')

const { getConfig, getLocalIP } = require('./util.cjs')
const {
  downloadRoutes,
  uploadRoutes,
  listRoutes,
  deleteRoutes,
  renameRoutes,
  moveRoutes,
  createRoutes
} = require('./router/index.cjs')
const { port } = getConfig()

const app = express()
// 解析post的两个中间件
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// 处理静态文件请求
app.use(express.static(path.join(__dirname, '../dist')))

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist', 'index.html'))
})

app.use('/api/list', listRoutes)
app.use('/api/uploads', uploadRoutes)
app.use('/api/download', downloadRoutes)
app.use('/api/delete', deleteRoutes)
app.use('/api/rename', renameRoutes)
app.use('/api/move', moveRoutes)
app.use('/api/create', createRoutes)

app.listen(port, () => {
  const ip = getLocalIP().find((i) => i.startsWith('192'))
  console.log(`http://${ip || 'localhost'}:${port}`)
})
