'use strict';

/**
 * bigfile router.
 */

module.exports = {
    routes: [
        { // Path defined with a URL parameter
            method: 'POST',
            path: '/bigfile/upload',
            handler: 'bigfile.upload',
            config: {
                auth: false,
            },
        },
        {
            method: 'POST',
            path: '/bigfile/megre',
            handler: 'bigfile.megre',
            config: {
                auth: false,
            },
        },
        {
            method: 'GET',
            path: `/bigfiles`,
            handler: `bigfile.find`,
            config: {},
        },
        {
            method: 'POST',
            path: '/bigfile/verify',
            handler: 'bigfile.verify',
            config: {
                auth: false
            },
        },
    ]
}
