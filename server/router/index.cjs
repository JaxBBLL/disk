/* eslint-disable no-undef */
const downloadRoutes = require('./download.cjs')
const uploadRoutes = require('./upload.cjs')
const listRoutes = require('./list.cjs')
const deleteRoutes = require('./delete.cjs')
const renameRoutes = require('./rename.cjs')
const moveRoutes = require('./move.cjs')
const createRoutes = require('./create.cjs')

module.exports = {
  downloadRoutes,
  uploadRoutes,
  listRoutes,
  deleteRoutes,
  renameRoutes,
  moveRoutes,
  createRoutes
}
