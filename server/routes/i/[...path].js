import { createReadStream, existsSync } from 'fs'
import { createHash } from 'crypto'
import db from '../../utils/db.js'
import { getImagePath } from '../../utils/upload.js'

export default defineEventHandler(async (event) => {
  try {
    // 获取路径参数，例如 /i/uuid.webp
    let path = getRouterParam(event, 'path')

    // [...path] 可能返回数组，需要处理
    if (Array.isArray(path)) {
      path = path.join('/')
    }

    if (!path) {
      throw createError({
        statusCode: 404,
        message: '图片不存在'
      })
    }

    // 解析 uuid 和扩展名
    const match = path.match(/^([a-f0-9-]+)\.(\w+)$/i)

    if (!match) {
      throw createError({
        statusCode: 404,
        message: '图片不存在'
      })
    }

    const [, uuid, ext] = match

    // 从数据库查找图片
    const image = await db.images.findOne({ uuid: uuid })

    if (!image) {
      throw createError({
        statusCode: 404,
        message: '图片不存在'
      })
    }

    // 检查是否已删除
    if (image.isDeleted) {
      throw createError({
        statusCode: 404,
        message: '图片不存在'
      })
    }

    // 检查是否为违规图片（NSFW）
    if (image.isNsfw) {
      throw createError({
        statusCode: 403,
        message: '该图片因违规已被禁止访问'
      })
    }

    // 检查文件是否存在
    const filePath = getImagePath(image.filename)

    if (!existsSync(filePath)) {
      console.log('[Image Route] File does not exist')
      throw createError({
        statusCode: 404,
        message: '图片文件不存在'
      })
    }

    // 设置响应头
    const mimeTypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'bmp': 'image/bmp',
      'ico': 'image/x-icon',
      'svg': 'image/svg+xml',
      'avif': 'image/avif',
      'tiff': 'image/tiff'
    }

    const contentType = mimeTypes[image.format] || 'application/octet-stream'

    // 生成 ETag（基于文件UUID和更新时间）
    const etag = `"${createHash('md5').update(`${image.uuid}-${image.updatedAt || image.createdAt}`).digest('hex')}"`

    // 检查 If-None-Match 头，支持 304 响应
    const ifNoneMatch = getHeader(event, 'if-none-match')
    if (ifNoneMatch === etag) {
      setResponseStatus(event, 304)
      return ''
    }

    // 计算过期时间（365天后）
    const maxAge = 365 * 24 * 60 * 60 // 365天，单位秒
    const expires = new Date(Date.now() + maxAge * 1000).toUTCString()

    // 设置完善的缓存响应头
    setHeader(event, 'Content-Type', contentType)
    setHeader(event, 'Content-Length', image.size)
    setHeader(event, 'Cache-Control', `public, max-age=${maxAge}, immutable`) // 365天缓存，immutable表示内容不会变化
    setHeader(event, 'Expires', expires) // 兼容旧浏览器
    setHeader(event, 'ETag', etag) // 支持条件请求
    setHeader(event, 'Last-Modified', new Date(image.createdAt).toUTCString()) // 最后修改时间
    setHeader(event, 'X-Content-Type-Options', 'nosniff') // 安全头

    // 返回文件流
    return sendStream(event, createReadStream(filePath))
  } catch (error) {
    if (error.statusCode) {
      throw error
    }

    console.error('[Image] 获取图片失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取图片失败'
    })
  }
})
