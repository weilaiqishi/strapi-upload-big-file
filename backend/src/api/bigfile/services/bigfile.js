'use strict';

/**
 * bigfile service.
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::bigfile.bigfile');
