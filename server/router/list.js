const express = require('express')
const path = require('path')
const util = require('util')
const fs = require('fs')
const readdir = util.promisify(fs.readdir)
const stat = util.promisify(fs.stat)
const router = express.Router()

const { getConfig, formatDate } = require('../util.js')
const { dest, hasDel } = getConfig()

router.post('/', async (req, res) => {
  const name = (req.body.name || '').trim().toLocaleLowerCase()
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
      const stats = await stat(filePath).catch(() => {
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
    let data = isDirectory ? ret.filter((i) => i.isDirectory) : ret
    if (name) {
      data = data.filter((i) => {
        return i.name.toLocaleLowerCase().indexOf(name) > -1
      })
    }
    return res.send({ code: 200, data, hasDel })
  } catch (err) {
    console.error(err)
    return res.status(500).send({ message: '读取目录失败' })
  }
})

module.exports = router
