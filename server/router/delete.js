const express = require('express')
const path = require('path')
const router = express.Router()

const { getConfig, deleteFileOrFolder } = require('../util.js')
const { dest } = getConfig()

router.post('/', async (req, res) => {
  const filePaths = req.body.filePaths || []
  const failedDeletions = []

  for (const filePath of filePaths) {
    const realFilePath = path.join(dest, filePath)
    try {
      await deleteFileOrFolder(realFilePath)
      console.log('文件删除成功：', filePath)
    } catch (error) {
      // 如果删除失败，记录失败的文件路径
      console.error('文件删除失败：', filePath, error.message)
      failedDeletions.push(filePath)
    }
  }

  if (failedDeletions.length > 0) {
    res.status(500).send({
      code: 500,
      message: '部分文件删除失败',
      failedDeletions: failedDeletions
    })
  } else {
    res.send({
      code: 200,
      message: '删除成功'
    })
  }
})

module.exports = router
