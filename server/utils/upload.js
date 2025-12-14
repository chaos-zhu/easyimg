import { existsSync, mkdirSync, unlinkSync } from 'fs'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { processImage, getImageMetadata } from './image.js'
import db from './db.js'

// 上传目录：生产环境使用 /app/uploads，开发环境使用项目根目录下的 uploads
const uploadsDir = process.env.NODE_ENV === 'production'
  ? '/app/uploads'
  : join(process.cwd(), 'uploads')

// 确保上传目录存在
if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true })
}

console.log('[Upload] 上传目录:', uploadsDir)

/**
 * 解析 multipart/form-data 请求
 */
export async function parseFormData(event) {
  const formData = await readMultipartFormData(event)

  if (!formData || formData.length === 0) {
    return { file: null }
  }

  // 查找文件字段
  const fileField = formData.find(field => field.name === 'file' || field.name === 'image')

  if (!fileField || !fileField.data) {
    return { file: null }
  }

  return {
    file: {
      buffer: fileField.data,
      originalFilename: fileField.filename || 'unknown',
      mimetype: fileField.type,
      size: fileField.data.length
    }
  }
}

/**
 * 获取文件扩展名（内部使用）
 */
function getFileExtension(filename) {
  const ext = filename.split('.').pop().toLowerCase()
  return ext
}

/**
 * 验证文件格式
 */
export function validateFormat(filename, allowedFormats) {
  const ext = getFileExtension(filename)
  return allowedFormats.map(f => f.toLowerCase()).includes(ext)
}

/**
 * 验证文件大小
 */
export function validateSize(size, maxSize) {
  return size <= maxSize
}

/**
 * 保存图片文件
 * @param {Buffer} buffer - 图片数据
 * @param {Object} options - 配置选项
 * @param {string} options.originalName - 原始文件名
 * @param {boolean} options.convertToWebp - 是否转换为 WebP
 * @param {number} options.webpQuality - WebP 质量
 * @param {string} options.uploadedBy - 上传者
 * @param {string} options.ip - 上传者 IP
 * @param {boolean} options.isPublic - 是否为公共上传
 */
export async function saveUploadedImage(buffer, options) {
  const {
    originalName,
    convertToWebp = false,
    webpQuality = 80,
    uploadedBy = '访客',
    ip = '',
    isPublic = true
  } = options

  const uuid = uuidv4()
  const originalExt = getFileExtension(originalName)

  let finalBuffer = buffer
  let finalExt = originalExt
  let isWebp = false

  // 如果需要转换为 WebP
  if (convertToWebp && originalExt !== 'gif') {
    finalBuffer = await processImage(buffer, {
      format: 'webp',
      quality: webpQuality
    })
    finalExt = 'webp'
    isWebp = true
  }

  // 获取图片信息
  const imageInfo = await getImageMetadata(finalBuffer)

  // 生成文件名和路径
  const filename = `${uuid}.${finalExt}`
  const filepath = join(uploadsDir, filename)

  // 保存文件
  await writeFile(filepath, finalBuffer)

  // 保存到数据库
  const imageRecord = {
    _id: uuidv4(),
    uuid,
    originalName,
    filename,
    size: finalBuffer.length,
    format: finalExt,
    width: imageInfo.width,
    height: imageInfo.height,
    isWebp,
    isPublic,
    uploadedBy,
    ip,
    isDeleted: false,
    uploadedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  await db.images.insert(imageRecord)

  // 返回图片信息（不包含敏感信息）
  return {
    uuid,
    filename,
    format: finalExt,
    size: finalBuffer.length,
    width: imageInfo.width,
    height: imageInfo.height,
    url: `/i/${uuid}.${finalExt}`
  }
}

/**
 * 删除图片文件
 */
export async function deleteImageFile(filename) {
  const filepath = join(uploadsDir, filename)
  if (existsSync(filepath)) {
    unlinkSync(filepath)
    return true
  }
  return false
}

/**
 * 获取图片文件路径
 */
export function getImagePath(filename) {
  return join(uploadsDir, filename)
}

/**
 * 获取上传目录路径
 */
export function getUploadsDirPath() {
  return uploadsDir
}
