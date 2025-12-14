import { createReadStream, existsSync } from 'fs'
import db from '../../../utils/db.js'
import { verifyToken, extractToken } from '../../../utils/jwt.js'
import { getImagePath } from '../../../utils/upload.js'

export default defineEventHandler(async (event) => {
  try {
    // 验证登录 - 支持 header 和 query 参数两种方式传递 token
    // 因为 <img> 标签无法设置 header，所以需要支持 query 参数
    let token = extractToken(event)

    // 如果 header 中没有 token，尝试从 query 参数获取
    if (!token) {
      const query = getQuery(event)
      token = query.token
    }

    if (!token) {
      throw createError({
        statusCode: 401,
        message: '请先登录'
      })
    }

    const user = await verifyToken(token)
    if (!user) {
      throw createError({
        statusCode: 401,
        message: 'Token 无效或已过期'
      })
    }

    // 获取路径参数，例如 /api/images/preview/uuid.webp
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

    // 从数据库查找图片（不检查 isDeleted，管理员可以查看所有图片）
    const image = await db.images.findOne({ uuid: uuid })

    if (!image) {
      throw createError({
        statusCode: 404,
        message: '图片不存在'
      })
    }

    // 检查文件是否存在
    const filePath = getImagePath(image.filename)

    if (!existsSync(filePath)) {
      console.log('[Admin Preview] File does not exist:', filePath)
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

    // 设置响应头（不缓存，因为是管理员预览）
    setHeader(event, 'Content-Type', contentType)
    setHeader(event, 'Content-Length', image.size)
    setHeader(event, 'Cache-Control', 'no-store, no-cache, must-revalidate')
    setHeader(event, 'X-Content-Type-Options', 'nosniff')

    // 返回文件流
    return sendStream(event, createReadStream(filePath))
  } catch (error) {
    if (error.statusCode) {
      throw error
    }

    console.error('[Admin Preview] 获取图片失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取图片失败'
    })
  }
})