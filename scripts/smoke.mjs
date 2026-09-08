/**
 * 接口冒烟测试：node scripts/smoke.mjs
 * 需先启动服务（pnpm dev 或 pnpm start）
 *
 * 所有测试数据都收敛在 smoke-root/ 下，结束时只删除该目录，
 * 不会影响磁盘根目录里的其他文件，可随时安全运行。
 */
import http from 'node:http'

const BASE = process.env.BASE || 'http://localhost:9527'

// 测试专用根目录
const T = 'smoke-root'
/** 相对 T 的路径 */
const p = (...parts) => [T, ...parts].filter(Boolean).join('/')

let passed = 0
let failed = 0

function check(name, ok, detail) {
  if (ok) {
    passed += 1
    console.log(`  ✓ ${name}`)
  } else {
    failed += 1
    console.log(`  ✗ ${name}${detail === undefined ? '' : ` -> ${JSON.stringify(detail)}`}`)
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
  check('响应返回实际落盘名', up1.json?.data?.[0] === '中文文件.txt', up1.json?.data)

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
  const dupRes = await fetch(
    `${BASE}/api/upload?filePath=${encodeURIComponent(p('upload-dir'))}`,
    {
      method: 'POST',
      body: dupForm
    }
  )
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
