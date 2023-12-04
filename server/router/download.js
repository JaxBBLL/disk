/* eslint-disable no-undef */
const express = require('express')
const path = require('path')
const fs = require('fs')
const archiver = require('archiver')
const mime = require('mime')
const router = express.Router()

const { getConfig } = require('../util.js')
const { dest } = getConfig()

function previewFile(req, res) {
  const filePath = req.query.filePath
  const realFilePath = path.join(dest, filePath)

  const stream = fs.createReadStream(realFilePath)

  stream.on('open', () => {
    const stat = fs.statSync(realFilePath)
    const fileExtension = path.extname(realFilePath)
    let contentType = mime.getType(fileExtension) || 'application/octet-stream' // 默认为二进制流

    res.writeHead(200, {
      'Content-Type': contentType + '; charset=utf-8',
      'Content-Length': stat.size,
      'Content-Disposition': 'inline' // 在浏览器中打开文件，如果需要下载则为'attachment'
    })
    // 将文件流通过管道传输到响应中
    stream.pipe(res)
  })

  stream.on('error', (err) => {
    res.statusCode = 500
    res.end(`Error getting the file: ${err}`)
  })
}

router.get('/file/:name?', (req, res) => {
  const name = req.params.name
  if (name) {
    previewFile(req, res)
    return
  }
  const filePath = req.query.filePath
  const fileName = path.basename(filePath)
  const realFilePath = path.join(dest, filePath)

  // 设置响应头，指定文件类型和名称
  res.setHeader('Content-Type', 'application/octet-stream')
  res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(fileName)}`)

  // 将文件流式传输到响应中
  const stream = fs.createReadStream(realFilePath)
  stream.pipe(res)
})

router.get('/folder', (req, res) => {
  const filePath = req.query.filePath
  const folderPath = path.join(dest, filePath)
  let zipFileName = `${folderPath}.zip`

  while (fs.existsSync(zipFileName)) {
    // 确保文件名唯一，不覆盖现有文件
    const random = Math.random().toString(16).replace('0.', '')
    zipFileName = `${folderPath}_${random}.zip`
  }

  // 创建一个新的压缩包
  const output = fs.createWriteStream(zipFileName)
  const archive = archiver('zip', {
    zlib: { level: 9 } // 压缩级别（0-9）
  })

  output.on('close', () => {
    console.log(`${archive.pointer()} total bytes`)
    console.log('压缩完成')
    res.download(zipFileName, zipFileName, (err) => {
      if (err) {
        res.status(500).send('下载失败')
      }
      // 删除生成的临时压缩包
      fs.unlinkSync(zipFileName)
    })
  })

  archive.on('error', (err) => {
    throw err
  })

  // 将压缩包输出到 output 流
  archive.pipe(output)

  // 将文件夹中的所有文件添加到压缩包
  archive.directory(folderPath, false)
  archive.finalize()
})

module.exports = router
