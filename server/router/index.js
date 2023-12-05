const downloadRoutes = require('./download')
const uploadRoutes = require('./upload')
const listRoutes = require('./list')
const deleteRoutes = require('./delete')
const renameRoutes = require('./rename')
const moveRoutes = require('./move')
const createRoutes = require('./create')

module.exports = {
  downloadRoutes,
  uploadRoutes,
  listRoutes,
  deleteRoutes,
  renameRoutes,
  moveRoutes,
  createRoutes
}
