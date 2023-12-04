/* eslint-disable no-undef */
const express = require('express')
const path = require('path')
const fs = require('fs')
const util = require('util')
const exists = util.promisify(fs.exists)
const router = express.Router()

const { getConfig } = require('../util.js')
const { dest } = getConfig()

router.post('/', async (req, res) => {
  const filePaths = req.body.filePaths || []
  const newFolder = req.body.newFolder || ''
  const responses = []

  if (!filePaths.length) {
    res.status(500).send({
      code: 500,
      message: '请选择文件'
    })
    return
  }

  try {
    for (const oldPath of filePaths) {
      const oldFolderPath = path.resolve(dest, oldPath)
      const fileName = path.basename(oldFolderPath)
      const newFolderPath = path.resolve(dest, newFolder, fileName)

      if (await exists(newFolderPath)) {
        responses.push({
          code: 200,
          isExit: 1,
          message: '目录存在相同文件名'
        })
        continue
      }

      try {
        await fs.promises.rename(oldFolderPath, newFolderPath)
        responses.push({
          code: 200,
          data: true,
          message: '修改成功'
        })
      } catch (error) {
        responses.push({
          code: 500,
          message: `修改失败: ${error.message}`
        })
      }
    }

    // 发送整体的响应
    res.send({
      code: 200,
      data: responses
    })
  } catch (error) {
    res.status(500).send({
      message: `出现错误: ${error.message}`
    })
  }
})

module.exports = router
