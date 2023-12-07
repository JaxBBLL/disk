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

// Function to compress files/folders into a zip archive and initiate download
function compressAndDownload(files, res) {
  let zipFileName
  if (files && files.length === 1) {
    zipFileName = files[0] + '.zip'
    while (fs.existsSync(zipFileName)) {
      // 确保文件名唯一，不覆盖现有文件
      const random = Math.random().toString(16).replace('0.', '')
      zipFileName = `${files[0]}_${random}.zip`
    }
  } else {
    zipFileName = Date.now() + '.zip'
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
        fs.unlinkSync(zipFileName) // Delete the zip file after download
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

// Route for compressing a single folder
router.get('/folder', (req, res) => {
  const filePath = req.query.filePath
  const folderPath = path.join(dest, filePath)

  const filesToCompress = [folderPath]
  compressAndDownload(filesToCompress, res)
})

// Route for compressing multiple files/folders
router.get('/zip', (req, res) => {
  const filePaths = JSON.parse(req.query.filePaths || '[]')
  const folderPaths = filePaths.map((filePath) => path.join(dest, filePath))

  const filesToCompress = folderPaths
  compressAndDownload(filesToCompress, res)
})

module.exports = router
