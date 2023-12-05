const express = require('express')
const path = require('path')
const router = express.Router()

const { getConfig, createFolder } = require('../util.js')
const { dest } = getConfig()

router.post('/', async (req, res) => {
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

module.exports = router
