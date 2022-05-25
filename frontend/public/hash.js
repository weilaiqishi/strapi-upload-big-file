// web-worker
self.importScripts('spark-md5.min.js')

self.onmessage = (e) => {
    // 接受主线程的通知
    const { file, chunkSize = 5 * 1024 * 1024 } = e.data
    const spark = new self.SparkMD5.ArrayBuffer()
    const reader = new FileReader()
    const size = file.size
    const offset = chunkSize
    let chunks = [file.slice(0, offset)]
    let cur = offset
    while (cur < size) {
        // 最后一块全部加进来
        if (cur + offset >= size) {
            chunks.push(file.slice(cur, cur + offset))
        } else {
            // 中间的 前中后取两个字节
            const mid = cur + offset / 2
            const end = cur + offset
            chunks.push(file.slice(cur, cur + 2))
            chunks.push(file.slice(mid, mid + 2))
            chunks.push(file.slice(end - 2, end))
        }
        cur += offset
    }
    // 拼接
    reader.readAsArrayBuffer(new Blob(chunks))
    reader.onload = (e) => {
        spark.append(e.target.result)
        self.postMessage({
            hashMd5: spark.end()
        })
    }
}
