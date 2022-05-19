import React, { useState, useRef } from 'react';
import { Upload, message, Button, Progress, Card, List, Spin } from 'antd';
import { RcFile } from 'antd/lib/upload';
import { UploadFile } from 'antd/lib/upload/interface';
import { UploadOutlined } from '@ant-design/icons';

import * as utils from './utils'

import './App.css';

function createChunk(file: RcFile, size = 5 * 1024 * 1024) {
  const chunkList: {
    file: Blob;
  }[] = []
  let cur = 0
  while (cur < file.size) {
    chunkList.push({ file: file.slice(cur, cur + size) }) // 使用slice方法切片
    cur += size
  }
  return chunkList
}

const UpLoadComponent = () => {
  const [uploading, setuploading] = useState(false)
  const [fileList, setfileList] = useState<RcFile[]>([])
  const beforeUpload = (selectFile: RcFile, selectFileList: RcFile[]) => { // 选中文件
    setfileList([...fileList, ...selectFileList])
  };
  const onRemove = (file: UploadFile) => { // 移除选中
    const index = fileList.indexOf(file as RcFile);
    const newFileList = fileList.slice();
    newFileList.splice(index, 1);
    setfileList(newFileList)
  }

  type typeFileListCookedItem = {
    file: Blob
    size: number
    percent: number
    chunkName: string
    fileName: string
  }
  type typeProgressEvent = {
    total: number
    loaded: number
  }
  const refFileListCooked = useRef<typeFileListCookedItem[]>([])
  const [totalProgress, settotalProgress] = useState(0)
  const handleUpload = () => { // 正式上传
    if (!fileList.length) return
    refFileListCooked.current = []
    settotalProgress(0)
    fileList.forEach(fileItem => {
      const chunkList = createChunk(fileItem)
      console.log(`handleUpload -> ${fileItem.name} chunkList -> `, chunkList) // 看看chunkList长什么样子
      refFileListCooked.current.push( // 处理切片信息
        ...chunkList.map(({ file }, index) => ({
          file,
          size: file.size,
          percent: 0,
          chunkName: `${fileItem.name}-${index}`,
          fileName: fileItem.name,
        }))
      )
    })
    uploadChunks() // 执行上传切片的操作
    setfileList([])
  }

  function uploadChunks() {
    setuploading(true)
    const requestList = refFileListCooked.current
      .map(({ file, fileName, chunkName }) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('fileName', fileName);
        formData.append('chunkName', chunkName);
        return { formData };
      })
      .map(({ formData }, index) =>
        () => utils.axiosUpload(
          'http://localhost:1337/api/bigfile/upload',
          formData,
          (progressEvent: typeProgressEvent) => progressHandler(progressEvent, refFileListCooked.current[index]), // 传入监听上传进度回调
        )
      )
    utils.asyncPool(requestList, 5, () => {
      setuploading(false)
      message.success('上传成功')
    }) // 限制并发请求数量
  }

  function progressHandler(progressEvent: typeProgressEvent, fileListCookedItem: typeFileListCookedItem) {
    fileListCookedItem.percent = Math.floor((progressEvent.loaded / progressEvent.total) * 100)
    settotalProgress(
      Math.floor(
        refFileListCooked.current.reduce((acc, cur) => acc + cur.percent, 0) / refFileListCooked.current.length
      )
    )
  }

  return (
    <>
      <Upload fileList={fileList} beforeUpload={beforeUpload} onRemove={onRemove} customRequest={() => { }} multiple>
        <Button style={{ width: '200px' }} icon={<UploadOutlined />} loading={uploading} disabled={uploading}>Select File</Button>
      </Upload>
      <Button
        type='primary'
        onClick={handleUpload}
        style={{ marginTop: 16, width: '200px' }}
        loading={uploading}
        disabled={uploading}
      >
        {uploading ? 'Uploading' : 'Start Upload'}
      </Button>
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 16, width: '600px', height: '600px' }}>
        <Card title='总进度:' style={{ width: '100%' }} headStyle={{ fontWeight: 'bold' }}>
          <Progress percent={totalProgress}></Progress>
        </Card>
        <Card title='切片进度:' style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', width: '100%' }} headStyle={{ fontWeight: 'bold' }} bodyStyle={{ height: '400px'  }}>
          <List style={{ overflowY: 'auto', height: '100%' }}>
            {
              refFileListCooked.current.map(item => <List.Item key={item.chunkName}>
                <List.Item.Meta title={item.chunkName + ':'} description={<Progress percent={item.percent}></Progress>}></List.Item.Meta>
              </List.Item>
              )
            }
          </List>
        </Card>
      </div>
    </>
  )
}

function App() {
  return (
    <div className='App'>
      <header className='App-header'>
        <UpLoadComponent></UpLoadComponent>
      </header>
    </div>
  );
}

export default App;
