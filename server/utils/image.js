import sharp from 'sharp'
import { v4 as uuidv4 } from 'uuid'
import { join, extname } from 'path'
import { existsSync, mkdirSync, unlinkSync } from 'fs'
import { writeFile } from 'fs/promises'

// 上传目录：生产环境使用 /app/uploads，开发环境使用项目根目录下的 uploads
const uploadsDir = process.env.NODE_ENV === 'production'
  ? '/app/uploads'
  : join(process.cwd(), 'uploads')

// 确保 uploads 目录存在
if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true })
}

// 支持的图片格式
export const COMMON_FORMATS = ['jpeg', 'jpg', 'png', 'gif', 'webp', 'avif', 'svg', 'bmp', 'ico', 'apng', 'tiff', 'tif']
export const ALL_FORMATS = ['jpeg', 'jpg', 'png', 'gif', 'webp', 'avif', 'svg', 'bmp', 'ico', 'apng', 'tiff', 'tif']

/**
 * 获取图片元信息
 */
export async function getImageMetadata(buffer) {
  try {
    const metadata = await sharp(buffer).metadata()
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: buffer.length
    }
  } catch (error) {
    console.error('获取图片元信息失败:', error)
    return { width: 0, height: 0, format: 'unknown', size: buffer.length }
  }
}

/**
 * 处理图片（压缩/转换格式）
 */
export async function processImage(buffer, options = {}) {
  const { format = 'webp', quality = 80 } = options
  try {
    // GIF 不转换，保持原格式
    if (options.skipGif) {
      const metadata = await sharp(buffer).metadata()
      if (metadata.format === 'gif') {
        return buffer
      }
    }

    const processed = await sharp(buffer)
      .toFormat(format, { quality })
      .toBuffer()
    return processed
  } catch (error) {
    console.error('处理图片失败:', error)
    throw error
  }
}

/**
 * 保存上传的文件到磁盘
 */
export async function saveUploadedFile(buffer, filename) {
  const filepath = join(uploadsDir, filename)
  await writeFile(filepath, buffer)
  return filepath
}

/**
 * 压缩并转换为 WebP
 */
export async function compressToWebP(buffer, quality = 80) {
  try {
    const compressed = await sharp(buffer)
      .webp({ quality })
      .toBuffer()
    return compressed
  } catch (error) {
    console.error('压缩图片失败:', error)
    throw error
  }
}

/**
 * 转换为 WebP（不压缩）
 */
export async function convertToWebP(buffer) {
  try {
    const converted = await sharp(buffer)
      .webp({ lossless: true })
      .toBuffer()
    return converted
  } catch (error) {
    console.error('转换图片失败:', error)
    throw error
  }
}

/**
 * 保存图片到磁盘
 */
export async function saveImage(buffer, filename) {
  const filepath = join(uploadsDir, filename)
  await sharp(buffer).toFile(filepath)
  return filepath
}

/**
 * 删除图片文件
 */
export function deleteImage(filename) {
  const filepath = join(uploadsDir, filename)
  if (existsSync(filepath)) {
    unlinkSync(filepath)
    return true
  }
  return false
}

/**
 * 生成唯一文件名
 */
export function generateFilename(extension) {
  const uuid = uuidv4()
  return `${uuid}.${extension}`
}

/**
 * 获取文件扩展名
 */
export function getExtension(filename) {
  return extname(filename).toLowerCase().replace('.', '')
}

/**
 * 验证图片格式
 */
export function isValidFormat(format, allowedFormats) {
  return allowedFormats.map(f => f.toLowerCase()).includes(format.toLowerCase())
}

/**
 * 获取 uploads 目录路径
 */
export function getUploadsDir() {
  return uploadsDir
}

/**
 * 获取图片文件路径
 */
export function getImageFilePath(filename) {
  return join(uploadsDir, filename)
}

export default {
  COMMON_FORMATS,
  ALL_FORMATS,
  getImageMetadata,
  compressToWebP,
  convertToWebP,
  saveImage,
  deleteImage,
  generateFilename,
  getExtension,
  isValidFormat,
  getUploadsDir
}
