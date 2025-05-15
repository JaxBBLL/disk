const path = require('path')
const fs = require('fs')
const os = require('os')
const util = require('util')
const exists = util.promisify(fs.exists)
const mkdir = util.promisify(fs.mkdir)

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

let appConfig = null

function getConfig() {
  if (appConfig) {
    return appConfig
  }
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

  if (!fs.existsSync(configFile)) {
    // 如果文件不存在，则创建并写入内容
    fs.writeFileSync(configFile, JSON.stringify(defaultConfig, null, 2))
    console.log('已创建配置文件config.json')
  } else {
    console.log('已存在配置文件config.json')
  }

  appConfig = {
    dest,
    hasDel,
    port
  }

  return appConfig
}

module.exports = {
  getLocalIP,
  deleteFileOrFolder,
  createFolder,
  formatDate,
  getConfig
}
