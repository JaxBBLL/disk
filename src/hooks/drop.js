export default (cb) => {
  let origin = null

  const dragStart = (item, event) => {
    origin = item
  }

  const drop = (target, event) => {
    if (target.isDirectory) {
      cb(origin, target)
    }
    origin = null
  }

  const dropOver = (target, event) => {
    event.preventDefault()
    if (target.isDirectory) {
      event.dataTransfer.dropEffect = 'move'
    } else {
      event.dataTransfer.dropEffect = 'none'
    }
  }

  return {
    dragStart,
    drop,
    dropOver
  }
}
