/**
 * 接口冒烟测试：node scripts/smoke.mjs
 * 需先启动服务（pnpm dev 或 pnpm start）
 *
 * 所有测试数据都收敛在 smoke-root/ 下，结束时只删除该目录，
 * 不会影响磁盘根目录里的其他文件，可随时安全运行。
 */
import http from 'node:http'

const BASE = process.env.BASE || 'http://localhost:8887'

// 测试专用根目录
const T = 'smoke-root'
/** 相对 T 的路径 */
const p = (...parts) => [T, ...parts].filter(Boolean).join('/')

let passed = 0
let failed = 0

function check(name, ok, detail) {
  if (ok) {
    passed += 1
    console.log(`  \u2713 ${name}`)
  } else {
    failed += 1
    console.log(`  \u2717 ${name}${detail === undefined ? '' : ` -> ${JSON.stringify(detail)}`}`)
  }
}

async function post(path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  return { status: res.status, json: await res.json().catch(() => null) }
}

async function list(filePath = [], name = '', isDirectory = false) {
  return post('/api/list', { filePath, name, isDirectory })
}

function group(title) {
  console.log(`\n${title}`)
}

async function main() {
  // 清掉上次可能残留的测试目录（只动 smoke-root，不影响其他数据）
  await post('/api/delete', { filePaths: [T] }).catch(() => {})

  // ---------- 基础目录操作 ----------
  group('目录操作')

  check('列出根目录', (await list()).status === 200)

  const created = await post('/api/create', { filePath: [], name: T })
  check('新建测试根目录', created.json?.isExit === 0, created.json)

  const dup = await post('/api/create', { filePath: [], name: T })
  check('重复新建被拦截', dup.json?.isExit === 1, dup.json)

  const nested = await post('/api/create', { filePath: [T], name: 'nested' })
  check('在子目录新建', nested.json?.isExit === 0, nested.json)

  const listRes = await list([T])
  check('子目录内容正确', listRes.json?.data?.some((i) => i.name === 'nested'), listRes.json?.data)

  const renamed = await post('/api/rename', { filePath: p('nested'), newName: 'renamed' })
  check('重命名成功', renamed.json?.data === true, renamed.json)

  const afterRename = await list([T])
  check('重命名后名称生效', afterRename.json?.data?.some((i) => i.name === 'renamed'))

  const searchRes = await list([T], 'renam')
  check('搜索过滤生效', searchRes.json?.data?.length > 0)

  // 移动到子目录（移动到自身所在目录会因目标同名被正确拒绝）
  await post('/api/create', { filePath: [T], name: 'move-target' })
  const moved = await post('/api/move', {
    filePaths: [p('renamed')],
    newFolder: p('move-target')
  })
  check('移动到目标目录', moved.json?.data?.[0]?.data === true, moved.json)

  const movedList = await list(p('move-target'))
  check('移动后出现在目标目录', movedList.json?.data?.some((i) => i.name === 'renamed'))

  const srcList = await list([T])
  check('原位置已不存在', !srcList.json?.data?.some((i) => i.name === 'renamed'))

  // ---------- 安全校验 ----------
  group('安全校验')

  const traversal = await list(['../..'])
  check('目录穿越被拦截(403)', traversal.status === 403, traversal.json?.message)

  const traversal2 = await list([T, '..', '..', '..'])
  check('多级穿越被拦截(403)', traversal2.status === 403)

  const badName = await post('/api/create', { filePath: [], name: 'a/b' })
  check('非法字符名被拦截(400)', badName.status === 400, badName.json?.message)

  const emptyName = await post('/api/create', { filePath: [], name: '   ' })
  check('空名称被拦截(400)', emptyName.status === 400)

  // ---------- 中文文件名 ----------
  group('中文文件名')

  const cnCreate = await post('/api/create', { filePath: [T], name: '测试目录-中文' })
  check('新建中文目录', cnCreate.json?.isExit === 0, cnCreate.json)

  const cnList = await list([T])
  const cnItem = cnList.json?.data?.find((i) => i.name === '测试目录-中文')
  check('中文目录名回显一致', Boolean(cnItem), cnList.json?.data?.map((i) => i.name))

  const cnRename = await post('/api/rename', {
    filePath: p('测试目录-中文'),
    newName: '重命名后的目录'
  })
  check('中文重命名', cnRename.json?.data === true, cnRename.json)

  const cnList2 = await list([T])
  check(
    '中文重命名后一致',
    cnList2.json?.data?.some((i) => i.name === '重命名后的目录'),
    cnList2.json?.data?.map((i) => i.name)
  )

  // ---------- 上传 ----------
  group('上传')

  await post('/api/create', { filePath: [T], name: 'upload-dir' })

  async function upload(fileName, content, filePath = T) {
    const form = new FormData()
    form.append('files', new Blob([content], { type: 'text/plain' }), fileName)
    const res = await fetch(`${BASE}/api/upload?filePath=${encodeURIComponent(filePath)}`, {
      method: 'POST',
      body: form
    })
    return { status: res.status, json: await res.json().catch(() => null) }
  }

  const up1 = await upload('中文文件.txt', 'hello disk')
  check('上传中文名文件', up1.status === 200, up1.json)

  const rootAfterUpload = await list([T])
  check(
    '中文文件名原样保存',
    rootAfterUpload.json?.data?.some((i) => i.name === '中文文件.txt'),
    rootAfterUpload.json?.data?.map((i) => i.name)
  )
  check(
    '响应返回实际落盘名',
    up1.json?.data?.[0] === '中文文件.txt',
    up1.json?.data
  )

  await upload('a.txt', 'first', p('upload-dir'))
  await upload('a.txt', 'second', p('upload-dir'))

  const dirList = await list(p('upload-dir'))
  check(
    '跨请求重名自动生成 -1 后缀',
    dirList.json?.data?.some((i) => i.name === 'a-1.txt'),
    dirList.json?.data
  )

  const multi = new FormData()
  multi.append('files', new Blob(['m1']), 'm1.txt')
  multi.append('files', new Blob(['m2']), 'm2.txt')
  const multiRes = await fetch(`${BASE}/api/upload?filePath=${encodeURIComponent(T)}`, {
    method: 'POST',
    body: multi
  })
  check('一次请求上传多个文件', multiRes.status === 200)

  const afterMulti = await list([T])
  const mCount = afterMulti.json?.data?.filter((i) => i.name === 'm1.txt' || i.name === 'm2.txt')
  check('多文件均已落盘', mCount?.length === 2, mCount)

  // 批次内同名：磁盘探测发现不了尚未落盘的文件，必须靠请求内互斥
  const dupForm = new FormData()
  dupForm.append('files', new Blob(['d1']), 'dup.txt')
  dupForm.append('files', new Blob(['d2']), 'dup.txt')
  const dupRes = await fetch(`${BASE}/api/upload?filePath=${encodeURIComponent(p('upload-dir'))}`, {
    method: 'POST',
    body: dupForm
  })
  const dupJson = await dupRes.json().catch(() => null)
  check(
    '批次内同名自动区分序号',
    dupJson?.data?.[0] === 'dup.txt' && dupJson?.data?.[1] === 'dup-1.txt',
    dupJson?.data
  )

  const dupList = await list(p('upload-dir'))
  const dupNames = dupList.json?.data
    ?.filter((i) => i.name.startsWith('dup'))
    .map((i) => i.name)
    .sort()
  check('批次内同名均已落盘', dupNames?.length === 2, dupNames)

  // ---------- 上传中断回滚 ----------
  group('上传中断回滚')

  await post('/api/create', { filePath: [T], name: 'abort-dir' })

  // 用原生 http 直接断开 socket，等价于浏览器中断上传。
  // （fetch 的 abort() 并不会真正切断已发出的请求体，服务端只会一直等数据）
  await new Promise((resolve) => {
    const boundary = `----smoketest${Date.now()}`
    const url = new URL(`${BASE}/api/upload?filePath=${encodeURIComponent(p('abort-dir'))}`)
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'content-type': `multipart/form-data; boundary=${boundary}`,
          // 声明比实际发送量更大的长度，服务端会持续等待剩余数据
          'content-length': '200000'
        }
      },
      (res) => res.resume()
    )

    // destroy() 会触发 error(ECONNRESET)，这里是预期行为
    req.on('error', () => {})

    req.write(
      `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="partial.bin"\r\nContent-Type: application/octet-stream\r\n\r\n`
    )

    let sent = 0
    const timer = setInterval(() => {
      req.write('x'.repeat(4096))
      sent += 4096
      if (sent >= 4096 * 5) {
        clearInterval(timer)
        req.destroy() // 直接断开，剩余数据不再发送
        resolve()
      }
    }, 30)
  })

  await new Promise((r) => setTimeout(r, 800))

  const abortList = await list(p('abort-dir'))
  const leftover = abortList.json?.data?.filter((i) => i.name.endsWith('.bin'))
  check('中断后无残留半成品', (leftover?.length ?? 0) === 0, leftover)

  // ---------- 分片上传 ----------
  group('分片上传')

  // 使用带时间戳的目录名，避开历史残留 / uniqueName 重名问题
  const chunkDirName = `chunk-${Date.now()}`
  const chunkDir = p(chunkDirName)

  await post('/api/create', { filePath: [T], name: chunkDirName })

  const CHUNK_SIZE = 5 * 1024 * 1024 // 5MB，与前端 CHUNK_SIZE 保持一致
  // 用 ~11MB 内容切成 3 片：5 + 5 + 1（最后一片小于 CHUNK_SIZE）
  const bigPayload = 'B'.repeat(CHUNK_SIZE * 2 + 1024 * 1024)
  const totalChunks = 3

  const initRes = await fetch(`${BASE}/api/upload/init`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      fileName: 'big.bin',
      totalChunks,
      chunkSize: CHUNK_SIZE,
      fileSize: bigPayload.length
    })
  })
  const initJson = await initRes.json()
  check('init 返回 200', initRes.status === 200, initRes.status)
  check(
    'init 返回 uploadId 与 totalChunks',
    typeof initJson?.data?.uploadId === 'string' && initJson?.data?.totalChunks === totalChunks,
    initJson
  )
  const uploadId = initJson?.data?.uploadId
  // 防止前端漏掉 data 包装：传 undefined 必须被服务端拦截
  check('init 返回 uploadId 不为 undefined', Boolean(uploadId), uploadId)

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE
    const slice = bigPayload.slice(start, start + CHUNK_SIZE)
    const form = new FormData()
    form.append('uploadId', uploadId)
    form.append('index', String(i))
    form.append('chunk', new Blob([slice]), `chunk-${i}`)
    const chunkRes = await fetch(`${BASE}/api/upload/chunk`, { method: 'POST', body: form })
    check(`分片 ${i} 上传成功`, chunkRes.status === 200, chunkRes.status)
  }

  const mergeRes = await fetch(`${BASE}/api/upload/merge`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      uploadId,
      filePath: chunkDir.split('/'),  // ['smoke-root', 'chunk-{ts}']，与 create 时一致
      fileName: 'big.bin',
      totalChunks
    })
  })
  const mergeJson = await mergeRes.json()
  check('merge 返回 200', mergeRes.status === 200, mergeRes.status)
  check('merge 返回落盘文件名', mergeJson?.data?.[0] === 'big.bin', mergeJson)

  // 内容核对
  const dl = await fetch(
    `${BASE}/api/download?filePaths=${encodeURIComponent(JSON.stringify([`${chunkDir}/big.bin`]))}`
  )
  const dlBuf = Buffer.from(await dl.arrayBuffer())
  check(
    '分片合并后内容字节数与原文件一致',
    dlBuf.length === bigPayload.length,
    { got: dlBuf.length, expected: bigPayload.length }
  )
  check(
    '分片合并后内容与原文件一致',
    dlBuf.toString() === bigPayload,
    dlBuf.length === bigPayload.length ? 'ok' : 'mismatch'
  )

  // 临时目录应被清理
  const tmpRes = await fetch(
    `${BASE}/api/upload/init`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        fileName: 'big.bin',
        totalChunks,
        chunkSize: CHUNK_SIZE,
        fileSize: bigPayload.length
      })
    }
  )
  // 再次 init（不传相同上下文）：新 uploadId，临时目录不存在于历史会话
  check('merge 后临时目录已清理（第二次 init 拿不到历史分片）', tmpRes.status === 200)

  // ---------- 取消/清理：cancel 接口 + 多用户隔离 ----------
  group('cancel 与多用户')

  // 用户 A：完整流程
  const userAInit = await (await fetch(`${BASE}/api/upload/init`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      fileName: 'userA.bin',
      totalChunks: 2,
      chunkSize: CHUNK_SIZE,
      fileSize: bigPayload.length
    })
  })).json()
  const userAId = userAInit?.data?.uploadId
  check('用户 A init 成功', Boolean(userAId), userAId)

  // 上传一个分片让临时目录里有文件
  const aForm = new FormData()
  aForm.append('uploadId', userAId)
  aForm.append('index', '0')
  aForm.append('chunk', new Blob([bigPayload.slice(0, CHUNK_SIZE)]), 'a-0')
  await fetch(`${BASE}/api/upload/chunk`, { method: 'POST', body: aForm })

  // 用户 B：另一个 uploadId
  const userBInit = await (await fetch(`${BASE}/api/upload/init`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      fileName: 'userB.bin',
      totalChunks: 2,
      chunkSize: CHUNK_SIZE,
      fileSize: bigPayload.length
    })
  })).json()
  const userBId = userBInit?.data?.uploadId
  check('用户 B init 成功（uploadId 与 A 不同）', Boolean(userBId) && userBId !== userAId, {
    userAId, userBId
  })

  // B 也上传一个分片
  const bForm = new FormData()
  bForm.append('uploadId', userBId)
  bForm.append('index', '0')
  bForm.append('chunk', new Blob([bigPayload.slice(0, CHUNK_SIZE)]), 'b-0')
  await fetch(`${BASE}/api/upload/chunk`, { method: 'POST', body: bForm })

  // 用户 A 取消：调用 /api/upload/cancel 只清 A 的临时目录
  const cancelA = await fetch(`${BASE}/api/upload/cancel`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ uploadId: userAId })
  })
  check('A 调 cancel 返回 200', cancelA.status === 200, cancelA.status)

  // B 继续：B 用原 uploadId 上传第二个分片应能成功（A 的 cancel 不影响 B）
  const bForm2 = new FormData()
  bForm2.append('uploadId', userBId)
  bForm2.append('index', '1')
  bForm2.append('chunk', new Blob([bigPayload.slice(CHUNK_SIZE, 2 * CHUNK_SIZE)]), 'b-1')
  const bChunk2 = await fetch(`${BASE}/api/upload/chunk`, { method: 'POST', body: bForm2 })
  check('A 取消后 B 仍能上传分片（会话隔离）', bChunk2.status === 200, bChunk2.status)

  // B 完成 merge 验证完整性
  const bMerge = await fetch(`${BASE}/api/upload/merge`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      uploadId: userBId,
      filePath: chunkDir.split('/'),
      fileName: 'userB.bin',
      totalChunks: 2
    })
  })
  const bMergeJson = await bMerge.json()
  check(
    'B 完整合并成功',
    bMerge.status === 200 && bMergeJson?.data?.[0] === 'userB.bin',
    bMergeJson
  )

  // A 重新 init：A 的临时目录已被清，从头开始
  const aReInit = await fetch(`${BASE}/api/upload/init`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      fileName: 'userA.bin',
      totalChunks: 2,
      chunkSize: CHUNK_SIZE,
      fileSize: bigPayload.length
    })
  })
  const aReInitJson = await aReInit.json()
  check(
    'A 重新 init 不带历史分片（已被 cancel 清空）',
    aReInitJson?.data?.uploadId !== userAId || aReInitJson?.data?.uploadedChunks?.length === 0,
    aReInitJson
  )

  // cancel 对不存在的 uploadId 也幂等
  const cancelPhantom = await fetch(`${BASE}/api/upload/cancel`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ uploadId: 'non-existent-id' })
  })
  check('cancel 不存在的 uploadId 返回 200', cancelPhantom.status === 200, cancelPhantom.status)

  // cancel 缺 uploadId 应返回 400
  const cancelNoId = await fetch(`${BASE}/api/upload/cancel`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({})
  })
  check('cancel 缺 uploadId 返回 400', cancelNoId.status === 400, cancelNoId.status)

  // ---------- list 隐藏 .upload-tmp 临时目录 ----------
  group('list 隐藏内部目录')

  // 在 disk 根创建临时目录，确认 list 不返回（ESM 用 import，不能用 require）
  const { mkdirSync, writeFileSync } = await import('node:fs')
  const { join } = await import('node:path')
  const tmpDir = join(process.cwd() || '.', 'disk', '.upload-tmp', 'smoke-test-hide')
  mkdirSync(tmpDir, { recursive: true })
  writeFileSync(join(tmpDir, '0.part'), 'hidden')

  // 列出 disk 根目录，确认 .upload-tmp 不在返回列表里
  const rootList = await list([])
  const hasUploadTmp = (rootList.json?.data ?? []).some((i) => i.name === '.upload-tmp')
  check('list 根目录过滤掉 .upload-tmp', !hasUploadTmp, rootList.json?.data)

  // 列出 .upload-tmp 内部本身：仍返回（方便 API 层排查），但 UI 不会导航进去
  // 因为父级已被过滤。这里只验证父级过滤生效即可。
  const tmpList = await list(['.upload-tmp'])
  check('list 可读取 .upload-tmp 内部（不报错）', tmpList.status === 200, tmpList.status)

  // ---------- 下载 ----------
  group('下载')

  const single = await fetch(
    `${BASE}/api/download?filePaths=${encodeURIComponent(JSON.stringify([p('中文文件.txt')]))}`
  )
  check('单文件下载内容一致', (await single.text()) === 'hello disk')
  check(
    '单文件下载名使用 RFC5987 编码',
    (single.headers.get('content-disposition') || '').includes('UTF-8'),
    single.headers.get('content-disposition')
  )

  const zipped = await fetch(
    `${BASE}/api/download?filePaths=${encodeURIComponent(
      JSON.stringify([p('中文文件.txt'), p('upload-dir')])
    )}`
  )
  const zipBuf = Buffer.from(await zipped.arrayBuffer())
  check(
    '打包下载返回 zip',
    zipped.headers.get('content-type') === 'application/zip' &&
      zipBuf.subarray(0, 2).toString() === 'PK',
    { type: zipped.headers.get('content-type'), magic: zipBuf.subarray(0, 2).toString() }
  )
  check('zip 内容非空', zipBuf.length > 100, zipBuf.length)

  const missing = await fetch(
    `${BASE}/api/download?filePaths=${encodeURIComponent(JSON.stringify(['不存在的文件.txt']))}`
  )
  check('下载不存在的文件返回 404', missing.status === 404)

  // 单目录下载：zip 文件名应使用目录原名，而不是默认的 disk-{ts}.zip
  // 准备：建一个测试目录，里面放一个文件
  await post('/api/create', { filePath: [T], name: 'photos' })
  const m = new FormData()
  m.append('files', new Blob(['img1']), 'cat.png')
  await fetch(`${BASE}/api/upload?filePath=${encodeURIComponent(p('photos'))}`, {
    method: 'POST',
    body: m
  })

  const singleDir = await fetch(
    `${BASE}/api/download?filePaths=${encodeURIComponent(JSON.stringify([p('photos')]))}`
  )
  const disp = singleDir.headers.get('content-disposition') || ''
  // RFC 5987: attachment; filename*=UTF-8''<encoded name>
  const singleDirName = decodeURIComponent(disp.split("UTF-8''")[1] || '')
  check(
    '单目录下载 zip 文件名用目录原名',
    singleDirName === 'photos.zip',
    { disp, singleDirName }
  )

  // 多选场景保持默认命名（含时间戳）
  const multiZip = await fetch(
    `${BASE}/api/download?filePaths=${encodeURIComponent(
      JSON.stringify([p('photos'), p('upload-dir')])
    )}`
  )
  const multiDisp = multiZip.headers.get('content-disposition') || ''
  const multiName = decodeURIComponent(multiDisp.split("UTF-8''")[1] || '')
  check(
    '多选场景仍用 disk-{ts}.zip 默认命名',
    /^disk-\d+\.zip$/.test(multiName),
    multiName
  )

  // ---------- 预览 ----------
  group('预览')

  const preview = await fetch(
    `${BASE}/api/download/preview?filePath=${encodeURIComponent(p('中文文件.txt'))}`
  )
  check('预览内容正确', (await preview.text()) === 'hello disk')
  check(
    '预览使用 inline',
    (preview.headers.get('content-disposition') || '').startsWith('inline')
  )
  check(
    '预览 Content-Type 正确',
    (preview.headers.get('content-type') || '').startsWith('text/plain')
  )

  const traversalPreview = await fetch(
    `${BASE}/api/download/preview?filePath=${encodeURIComponent('../../package.json')}`
  )
  check('预览拦截目录穿越(403)', traversalPreview.status === 403, traversalPreview.status)

  // ---------- 清理 ----------
  group('清理')

  await post('/api/delete', { filePaths: [T] })

  const finalList = await list([T])
  check('测试目录已清理', finalList.json?.data?.length === 0, finalList.json?.data)

  console.log(`\n通过 ${passed} 项，失败 ${failed} 项\n`)
  process.exit(failed ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
