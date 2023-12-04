/* eslint-disable no-undef */
const express = require('express')
const path = require('path')
const fs = require('fs')
const multer = require('multer')
const router = express.Router()

const { getConfig } = require('../util.cjs')
const { dest } = getConfig()

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

router.post('/', upload.array('files'), (req, res) => {
  if (req.files && req.files.length) {
    res.send({
      code: 200,
      message: '文件上传成功'
    })
  } else {
    res.status(500).send({ message: '文件上传失败' })
  }
})

module.exports = router
