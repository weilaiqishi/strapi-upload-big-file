import axios, { AxiosRequestConfig } from 'axios';
import { useState, useRef, useEffect } from 'react'

export function axiosUpload(
    url: string,
    data: FormData,
    onUploadProgress: AxiosRequestConfig['onUploadProgress'], // 进度回调
) {
    return new Promise((resolve, reject) => {
        axios({
            url,
            method: 'POST',
            data,
            onUploadProgress, // 传入监听进度回调
        })
            .then((res) => {
                resolve(res);
            })
            .catch((err) => {
                reject(err);
            });
    });
}

export function asyncPool(arr: any, max = 2, callback = () => { }) {
    let promiseArr: Promise<any>[] = [] // 存储并发max的promise数组
    let i = 0
    async function runOne() {
        if (i === arr.length) { return } // 所有请求都处理完
        let one = arr[i++]() // 执行一个函数,i++，保存fetch返回的promise
        promiseArr.push(one) // // 将当前promise存入并发数组
        one.then(() => { // 当promise执行完毕后，从数组删除
            promiseArr.splice(promiseArr.indexOf(one), 1);
        });

        if (promiseArr.length >= max) { // 如果当并行数量达到最大
            await Promise.race(promiseArr).then(runOne) // 用race等队列里有promise完成了才调用runOne
        } else {
            // 否则直接调用runOne让下一个并发入列
            await runOne()
        }
    }

    runOne().then(() => Promise.all(promiseArr)).then(() => { // arr循环完后 现在promiseArr里面剩下最后max个promise对象 使用all等待所有的都完成之后执行callback
        callback()
    })
}