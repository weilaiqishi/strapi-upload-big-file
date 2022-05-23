'use strict'

/**
 *  bigfile controller
 */

const { createCoreController } = require('@strapi/strapi').factories
const _ = require('lodash')
const utils = require('@strapi/utils')
const path = require('path')
const fse = require('fs-extra')
const UPLOAD_DIR = path.resolve(__dirname, '../../../../public/uploads/bigfile/chunk') // 切片存储目录
const UPLOAD_DIR_MEGRE = path.resolve(__dirname, '../../../../public/uploads/bigfile/megre') // 切片存储目录

module.exports = createCoreController('api::bigfile.bigfile', ({ strapi }) => ({
    async upload (ctx) {
        const {
            request: { files: { file = {} } },
        } = ctx
        const { fileName, chunkName } = ctx.request.body
        strapi.log.info(`>>> bigfile upload -> file.size, fileName, chunkName -> ${file.size}, ${fileName}, ${chunkName}`)
        if (_.isEmpty(file) || file.size === 0) {
            return new utils.errors.ValidationError('Files are empty')
        }
        const chunkDir = path.resolve(UPLOAD_DIR, `${fileName}-chunks`) // 保存切片的文件夹的路径
        if (!fse.existsSync(chunkDir)) { // 切片目录不存在，创建切片目录
            await fse.mkdirs(chunkDir)
        }
        await fse.move(file.path, `${chunkDir}/${chunkName}`, {
            overwrite: true
        }) // 把切片移动到切片文件夹

        return {
            code: 0,
            errMessage: ''
        }
    },
    async megre (ctx) {
        const pipeStream = (path, writeStream) => {
            return new Promise(resolve => {
                const readStream = fse.createReadStream(path)
                readStream.on('end', () => {
                    fse.unlinkSync(path)
                    resolve()
                })
                readStream.pipe(writeStream)
            })
        }

        const mergeFileChunk = async (fileName, chunkSize) => { // 合并切片
            let chunkPaths = null
            const chunkDir = path.resolve(UPLOAD_DIR, `${fileName}-chunks`)
            chunkPaths = await fse.readdir(chunkDir) // 获取切片文件夹里所有切片，返回一个数组
            // 根据切片下标进行排序 否则直接读取目录的获得的顺序可能会错乱
            chunkPaths.sort((a, b) => a.split('-')[1] - b.split('-')[1])
            const arr = chunkPaths.map((chunkPath, index) => {
                return pipeStream(
                    path.resolve(chunkDir, chunkPath),
                    // 指定位置创建可写流
                    fse.createWriteStream(path.resolve(UPLOAD_DIR_MEGRE, fileName), {
                        start: index * chunkSize,
                        end: (index + 1) * chunkSize,
                    })
                )
            })
            await Promise.all(arr)
            fse.rmdirSync(chunkDir) // 合并后删除保存切片的目录
        }

        const { fileName, size, chunkSize } = ctx.request.body
        await mergeFileChunk(fileName, chunkSize)

        // 保存文件记录
        const [sameBigFileRecord] = await strapi.entityService.findMany('api::bigfile.bigfile', { // 查询相同的文件名 目前没给文件起hash名 后来的会覆盖前面的文件
            filters: {
                fileName
            }
        })
        strapi.log.info('>>> megre -> sameBigFileRecord -> ' + JSON.stringify(sameBigFileRecord))
        let bigFileRecord
        if (sameBigFileRecord) {
            bigFileRecord = await strapi.entityService.update('api::bigfile.bigfile', sameBigFileRecord.id, {
                data: {
                    size
                },
            })
        } else {
            bigFileRecord = await strapi.entityService.create('api::bigfile.bigfile', {
                data: {
                    fileName,
                    size,
                    filePath: '/uploads/bigfile/megre/' + fileName
                }
            })
        }
        const sanitizedEntity = await this.sanitizeOutput(bigFileRecord, ctx)
        strapi.log.info('>>> megre -> sanitizedEntity -> ' + JSON.stringify(sanitizedEntity))
        return {
            code: 0,
            errMessage: '',
            data: {
                bigFileRecord: sanitizedEntity
            }
        }
    }
}))
