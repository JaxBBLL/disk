const express = require('express')
const path = require('path')
const fs = require('fs')
const archiver = require('archiver')
const mime = require('mime')
const router = express.Router()

const { getConfig } = require('../util.js')
const { dest } = getConfig()

router.get('/', (req, res) => {
  const filePaths = JSON.parse(req.query.filePaths || '[]')
  const folderPaths = filePaths.map((filePath) => path.join(dest, filePath))

  const filesToCompress = folderPaths
  compressAndDownload(filesToCompress, res)
})

router.get('/preview/:name?', (req, res) => {
  const name = req.params.name
  previewFile(req, res)
})

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

function setUniqueFileName(baseName) {
  let fileName = baseName
  while (fs.existsSync(fileName)) {
    const random = Math.random().toString(16).replace('0.', '')
    fileName = `${baseName}_${random}.zip`
  }
  return fileName
}

function downloadFile(filePath, res) {
  const fileName = path.basename(filePath)

  res.setHeader('Content-Type', 'application/octet-stream')
  res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(fileName)}`)

  const stream = fs.createReadStream(filePath)
  stream.pipe(res)
}

function compressAndDownload(files, res) {
  let zipFileName

  if (files.length === 1) {
    const file = files[0]
    const stat = fs.statSync(file)
    if (stat.isFile()) {
      downloadFile(file, res)
      return
    }
    zipFileName = setUniqueFileName(file + '.zip')
  } else {
    zipFileName = setUniqueFileName(Date.now() + '.zip')
  }

  const output = fs.createWriteStream(zipFileName)
  const archive = archiver('zip', { zlib: { level: 9 } })

  output.on('close', () => {
    console.log('压缩完成')
    res.download(zipFileName, zipFileName, (err) => {
      if (err) {
        console.error('下载错误:', err)
      } else {
        console.log('下载成功')
        fs.unlinkSync(zipFileName) // 在下载完成后删除压缩文件
      }
    })
  })

  archive.on('error', (err) => {
    console.error('压缩错误:', err)
    res.status(500).send({ error: '压缩失败' })
  })

  archive.pipe(output)

  files.forEach((file) => {
    const stat = fs.statSync(file)
    if (stat.isFile()) {
      archive.file(file, { name: path.basename(file) })
    } else if (stat.isDirectory()) {
      archive.directory(file, path.basename(file))
    }
  })

  archive.finalize()
}

module.exports = router
