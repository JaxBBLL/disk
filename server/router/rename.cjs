/* eslint-disable no-undef */
const express = require('express')
const path = require('path')
const fs = require('fs')
const util = require('util')
const exists = util.promisify(fs.exists)
const router = express.Router()

const { getConfig } = require('../util.cjs')
const { dest } = getConfig()

router.post('/', async (req, res) => {
  const filePath = req.body.filePath || ''
  const oldName = path.basename(filePath)
  const newName = req.body.newName || ''
  const newPath = filePath.split(oldName)[0] + newName
  const oldFolderPath = path.resolve(dest, filePath)
  const newFolderPath = path.resolve(dest, newPath)
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

module.exports = router
