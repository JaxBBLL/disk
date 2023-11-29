const path = require('path')
const fs = require('fs')
const os = require('os')
const util = require('util')
const readdir = util.promisify(fs.readdir)
const stat = util.promisify(fs.stat)
const exists = util.promisify(fs.exists)
const mkdir = util.promisify(fs.mkdir)
const express = require('express')
const multer = require('multer')
const archiver = require('archiver')
const mime = require('mime')

const defaultConfig = {
  dest: './',
  hasDel: true,
  port: 3000
}
const configFile = './config.json'

const config = (function () {
  try {
    const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), configFile), 'utf-8'))
    return Object.assign(defaultConfig, config)
  } catch {
    return defaultConfig
  }
})()
const { hasDel, port } = config
const dest = path.isAbsolute(config.dest) ? path.resolve(__dirname, config.dest) : config.dest
const app = express()
// 解析post的两个中间件
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

if (!fs.existsSync(configFile)) {
  // 如果文件不存在，则创建并写入内容
  fs.writeFileSync(configFile, JSON.stringify(defaultConfig, null, 2))
  console.log('已创建配置文件config.json')
} else {
  console.log('已存在配置文件config.json')
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const filePath = (req.query.filePath || '').split(',')
    const realPath = path.join(dest, ...filePath)
    if (!fs.existsSync(realPath)) {
      fs.mkdir(realPath, { recursive: true }, (err) => {
        if (err) throw err
        cb(null, realPath)
      })
    } else {
      cb(null, realPath)
    }
  },
  filename: function (req, file, cb) {
    const filePath = (req.query.filePath || '').split(',')
    // 获取上传文件的原始文件名，并处理中文乱码
    const originalname = Buffer.from(file.originalname, 'latin1').toString('utf8')
    const ext = path.extname(originalname)
    const baseName = path.basename(originalname, ext)

    const generateFileName = (base, ext, index) => {
      if (index === 0) {
        return `${base}${ext}`
      } else {
        return `${base}-${index}${ext}`
      }
    }

    let index = 0
    let newFileName = generateFileName(baseName, ext, index)

    while (fs.existsSync(path.join(dest, ...filePath, newFileName))) {
      index++
      newFileName = generateFileName(baseName, ext, index)
    }
    console.log('文件上传成功：', newFileName)
    cb(null, newFileName)
  }
})

const upload = multer({
  encoding: 'utf-8',
  storage: storage
})

// 处理静态文件请求
app.use(express.static(path.join(__dirname, 'dist')))

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

// 处理多文件上传的路由
app.post('/api/uploads', upload.array('files'), (req, res) => {
  if (req.files && req.files.length) {
    res.send({
      code: 200,
      message: '文件上传成功'
    })
  } else {
    res.status(500).send({ message: '文件上传失败' })
  }
})

app.post('/api/list', async (req, res) => {
  const paths = req.body.filePath || []
  const isDirectory = req.body.isDirectory || false
  try {
    const files = await readdir(path.join(dest, ...paths))
    if (!files.length) {
      return res.send({ code: 200, data: [] })
    }
    const ret = []
    for (let file of files) {
      const filePath = path.join(dest, ...paths, file)
      const stats = await stat(filePath).catch((err) => {
        return null
      })
      if (!stats) {
        continue
      }
      ret.push({
        name: file,
        isDirectory: stats.isDirectory(),
        filePath: path.join(...paths, file),
        size: (stats.size / 1024).toFixed(2),
        birthtime: formatDate(stats.birthtime, 'YYYY-MM-DD HH:mm'),
        updatetime: formatDate(stats.mtime, 'YYYY-MM-DD HH:mm'),
        hasDel
      })
    }
    const data = isDirectory ? ret.filter((i) => i.isDirectory) : ret
    return res.send({ code: 200, data })
  } catch (err) {
    console.error(err)
    return res.status(500).send({ message: '读取目录失败' })
  }
})
app.get('/api/download', (req, res) => {
  const filePath = req.query.filePath
  const fileName = path.basename(filePath)
  const realFilePath = path.join(dest, filePath)

  // 设置响应头，指定文件类型和名称
  res.setHeader('Content-Type', 'application/octet-stream')
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=${encodeURIComponent(fileName)}` // 对文件名进行URL编码
  )

  // 将文件流式传输到响应中
  const stream = fs.createReadStream(realFilePath)
  stream.pipe(res)
})

app.get('/api/preview/:filename', (req, res) => {
  const filename = req.params.filename || ''
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
})

app.get('/api/downloadFolder', (req, res) => {
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

app.get('/api/delete', (req, res) => {
  const filePath = req.query.filePath
  const realFilePath = path.join(dest, filePath)

  deleteFileOrFolder(realFilePath)
    .then((message) => {
      res.send({
        code: 200,
        message: '删除成功'
      })
      console.log('文件删除成功：', filePath)
    })
    .catch((err) => console.error('删除文件时发生错误:', err))
})

app.post('/api/rename', async (req, res) => {
  const basePath = req.body.basePath || []
  const oldPath = req.body.oldPath
  const newPath = req.body.newPath
  const oldFolderPath = path.resolve(dest, ...basePath, oldPath)
  const newFolderPath = path.resolve(dest, ...basePath, newPath)
  if (await exists(newFolderPath)) {
    res.send({
      code: 200,
      isExit: 1,
      message: '目录存在相同文件名'
    })
    return
  }
  try {
    await fs.promises.rename(oldFolderPath, newFolderPath)
    res.send({
      code: 200,
      data: true,
      message: '修改成功'
    })
  } catch {
    res.status(500).send({
      message: '修改失败'
    })
  }
})

app.post('/api/move', async (req, res) => {
  const oldPath = req.body.oldPath
  const newPath = req.body.newPath || []
  const oldFolderPath = path.resolve(dest, oldPath)
  const newFolderPath = path.resolve(dest, ...newPath)
  if (await exists(newFolderPath)) {
    res.send({
      code: 200,
      isExit: 1,
      message: '目录存在相同文件名'
    })
    return
  }
  try {
    await fs.promises.rename(oldFolderPath, newFolderPath)
    res.send({
      code: 200,
      data: true,
      message: '修改成功'
    })
  } catch {
    res.status(500).send({
      message: '修改失败'
    })
  }
})

app.post('/api/create', async (req, res) => {
  const paths = req.body.filePath || []
  const name = req.body.name
  const result = await createFolder(path.join(dest, ...paths), name)
  if (!result) {
    res.status(500).send({
      message: '创建失败'
    })
  } else if (result === 1) {
    res.send({
      code: 200,
      isExit: 0,
      message: '操作成功'
    })
  } else if (result === 2) {
    res.send({
      code: 200,
      isExit: 1,
      message: '目录已存在'
    })
  }
})

function getLocalIP() {
  const networkInterfaces = os.networkInterfaces()
  const addresses = []

  for (const interfaceName in networkInterfaces) {
    const networkInterface = networkInterfaces[interfaceName]

    for (let i = 0; i < networkInterface.length; i++) {
      const networkAddress = networkInterface[i]

      if (networkAddress.family === 'IPv4' && !networkAddress.internal) {
        addresses.push(networkAddress.address)
      }
    }
  }
  return addresses
}

async function deleteFileOrFolder(path) {
  try {
    // 判断路径是否为文件
    const stat = fs.statSync(path)
    if (stat.isFile()) {
      // 删除文件
      fs.unlinkSync(path)
      console.log(`File ${path} deleted successfully.`)
    } else if (stat.isDirectory()) {
      // 递归删除文件夹及其内容
      fs.rmSync(path, { recursive: true, force: true })
      console.log(`Folder ${path} deleted successfully.`)
    } else {
      console.log(`${path} is not a file or folder.`)
    }
  } catch (error) {
    console.error(`An error occurred while deleting ${path}: ${error.message}`)
  }
}

async function createFolder(directoryPath, newDirectoryName) {
  const newDirectoryPath = path.join(directoryPath, newDirectoryName)
  if (await exists(newDirectoryPath)) {
    return 2
  } else {
    try {
      await mkdir(newDirectoryPath, { recursive: true })
      return 1
    } catch (error) {
      return 0
    }
  }
}

function formatDate(date, fmt = 'YYYY-MM-DD HH:mm:ss') {
  if (!date) {
    return ''
  }
  if (typeof date === 'string') {
    date = new Date(date.replace(/-/g, '/'))
  }
  if (typeof date === 'number') {
    date = new Date(date)
  }
  var o = {
    'M+': date.getMonth() + 1,
    'D+': date.getDate(),
    'h+': date.getHours() % 12 === 0 ? 12 : date.getHours() % 12,
    'H+': date.getHours(),
    'm+': date.getMinutes(),
    's+': date.getSeconds(),
    'q+': Math.floor((date.getMonth() + 3) / 3),
    S: date.getMilliseconds()
  }
  var week = ['\u65e5', '\u4e00', '\u4e8c', '\u4e09', '\u56db', '\u4e94', '\u516d']
  if (/(Y+)/.test(fmt)) {
    fmt = fmt.replace(RegExp.$1, (date.getFullYear() + '').substr(4 - RegExp.$1.length))
  }
  if (/(E+)/.test(fmt)) {
    fmt = fmt.replace(
      RegExp.$1,
      (RegExp.$1.length > 1 ? (RegExp.$1.length > 2 ? '\u661f\u671f' : '\u5468') : '') +
        week[date.getDay()]
    )
  }
  for (var k in o) {
    if (new RegExp('(' + k + ')').test(fmt)) {
      fmt = fmt.replace(
        RegExp.$1,
        RegExp.$1.length === 1 ? o[k] : ('00' + o[k]).substr(('' + o[k]).length)
      )
    }
  }
  return fmt
}

app.listen(port, () => {
  const ip = getLocalIP().find((i) => i.startsWith('192'))
  console.log(`http://${ip || 'localhost'}:${port}`)
})
