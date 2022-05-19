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
}))
