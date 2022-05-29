import React, { useState, useRef } from 'react';
import { Upload, message, Button, Progress, Card, List, Drawer, Table } from 'antd';
import { RcFile } from 'antd/lib/upload';
import { UploadFile } from 'antd/lib/upload/interface';
import { UploadOutlined, UnorderedListOutlined, ThunderboltOutlined } from '@ant-design/icons';
import axios from 'axios'
import { useAntdTable, useEventEmitter } from 'ahooks'
import { EventEmitter } from 'ahooks/lib/useEventEmitter'

import * as utils from './utils'
import * as strapiApi from './strapiApi'

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

const UpLoadComponent = ({ eventBus }: { eventBus: EventEmitter<any> }) => {
  const [uploading, setuploading] = useState(false)
  const [stopping, setstopping] = useState(false)
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
    hasSameFile: boolean,
    isUploadedChunk: boolean
  }
  type typeProgressEvent = {
    total: number
    loaded: number
  }
  const refFileListCooked = useRef<typeFileListCookedItem[]>([])
  const [totalProgress, settotalProgress] = useState(0)
  const handleUpload = async () => { // 正式上传
    if (!fileList.length) return
    setuploading(true)
    setstopping(false)
    refFileListCooked.current = []
    if (totalProgress === 100) { // 满进度重新上传时重置 // 续传进度不重置
      settotalProgress(0)
    }
    const promiseArr = fileList.map((fileItem) => (async () => {
      const { data: { data: { hasSameFile, uploadedList } } } = await axios({
        url: 'http://localhost:1337/api/bigfile/verify',
        method: 'POST',
        data: { fileName: fileItem.name, hashMd5: await utils.calculateHash(fileItem, fileItem.name) },
      })
      if (hasSameFile) {
        const fileListCookedItem = {
          file: fileItem,
          size: fileItem.size,
          percent: 100,
          chunkName: fileItem.name,
          fileName: fileItem.name,
          hasSameFile,
          isUploadedChunk: false
        }
        refFileListCooked.current.push(fileListCookedItem)
        return
      }
      const chunkList = createChunk(fileItem)
      console.log(`handleUpload -> ${fileItem.name} chunkList -> `, chunkList) // 看看chunkList长什么样子
      refFileListCooked.current.push( // 处理切片信息
        ...chunkList.map(({ file }, index) => {
          const chunkName = `${fileItem.name}-${index}`
          return {
            file,
            size: file.size,
            percent: 0,
            chunkName,
            fileName: fileItem.name,
            hasSameFile: false,
            isUploadedChunk: (uploadedList as string[]).some(item => chunkName === item)
          }
        })
      )
    }
    )())
    await Promise.all(promiseArr)
    uploadChunks() // 执行上传切片的操作
  }

  const refCancelTokenSource = useRef(axios.CancelToken.source())
  function uploadChunks() {
    refFileListCooked.current
      .filter(({ hasSameFile, isUploadedChunk }) => hasSameFile === true || isUploadedChunk === true)
      .forEach(fileListCookedItem => progressHandler({ loaded: 100, total: 100 }, fileListCookedItem)) // 秒传文件 或 暂停已上传切片 进度直接100
    const requestList = refFileListCooked.current
      .filter(({ hasSameFile, isUploadedChunk }) => !(hasSameFile === true || isUploadedChunk === true))
      .map((fileListCookedItem) => {
        const { file, fileName, chunkName } = fileListCookedItem
        const formData = new FormData();
        formData.append('file', file);
        formData.append('fileName', fileName);
        formData.append('chunkName', chunkName);
        return { formData, fileListCookedItem };
      })
      .map(({ formData, fileListCookedItem }, index) =>
        () => utils.axiosUpload(
          'http://localhost:1337/api/bigfile/upload',
          formData,
          (progressEvent: typeProgressEvent) => progressHandler(progressEvent, fileListCookedItem), // 传入监听上传进度回调
          refCancelTokenSource.current.token
        )
      )
    utils.asyncPool(requestList, 5, async () => {
      const needUploadFiles = fileList.filter( // 过滤掉秒传文件，非秒传文件在切片上传完后才需要请求 megre
        rcFile => refFileListCooked.current.some(
          fileListCookedItem => (rcFile.name === fileListCookedItem.fileName) && fileListCookedItem.hasSameFile
        ) === false
      )
      const res = await Promise.allSettled(
        needUploadFiles.map(
          (fileItem) => (async () => {
            const hashMd5 = await utils.calculateHash(fileItem, fileItem.name)
            return axios({
              url: 'http://localhost:1337/api/bigfile/megre',
              method: 'POST',
              data: { fileName: fileItem.name, size: fileItem.size, chunkSize: 5 * 1024 * 1024, hashMd5 },
            })
          })()
        )
      )
      const success = res.reduce((prev, cur) => {
        console.log('uploadChunks megre res -> ', cur)
        if (cur.status === 'fulfilled' && cur.value.data.code === 0) {
          prev += 1
        }
        return prev
      }, 0)
      message.success(`上传成功${success}个，失败${needUploadFiles.length - success}个，秒传${refFileListCooked.current.filter(({ hasSameFile }) => hasSameFile).length}个`)
      setuploading(false)
      setfileList([])
      eventBus.emit({ type: 'uploaded' })
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

  function pauseUpload() {
    refCancelTokenSource.current.cancel('暂停')
    refCancelTokenSource.current = axios.CancelToken.source() // 生成下次用的CancelToken
    setstopping(true)
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
      {
        uploading && <Button
          type='primary'
          onClick={stopping ? handleUpload : pauseUpload}
          style={{ marginTop: 16, width: '200px', background: '#FFBA84', color: '#000000' }}
        >
          {stopping ? '续传' : '暂停'}
        </Button>
      }

      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 16, width: '600px', height: '600px' }}>
        <Card title='总进度:' style={{ width: '100%' }} headStyle={{ fontWeight: 'bold' }}>
          <Progress percent={totalProgress}></Progress>
        </Card>
        <Card title='切片进度:' style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', width: '100%' }} headStyle={{ fontWeight: 'bold' }} bodyStyle={{ height: '400px' }}>
          <List style={{ overflowY: 'auto', height: '100%' }}>
            {
              refFileListCooked.current.map(item => <List.Item key={item.chunkName}>
                <List.Item.Meta
                  title={<p>
                    {item.chunkName + ':'}
                    {item.hasSameFile &&
                      <span style={{ marginLeft: 10, color: '#1890ff', fontSize: 16, fontWeight: 600 }}>
                        <ThunderboltOutlined />
                        秒传
                      </span>
                    }
                  </p>}
                  description={<Progress percent={item.percent}></Progress>}></List.Item.Meta>
              </List.Item>
              )
            }
          </List>
        </Card>
      </div>
    </>
  )
}

const BigfileList = ({ eventBus }: { eventBus: EventEmitter<any> }) => {
  const [visible, setVisible] = useState(false)
  const showDrawer = () => {
    setVisible(true)
  }
  const onClose = () => {
    setVisible(false)
  }
  const { tableProps } = useAntdTable(
    ({ current, pageSize }) =>
      strapiApi.strapiNoticeList({ page: current, pageSize })
        .then(res => ({
          list: res.data.map(item => ({
            id: item.id,
            ...item.attributes
          })),
          total: res.meta.pagination.total
        }))
  )

  eventBus.useSubscription((val) => {
    console.log(val)
    if (val?.type === 'uploaded') {
      tableProps.onChange({ current: 1 })
    }
  })

  const columns = [
    {
      title: 'id',
      dataIndex: ['id'],
    },
    {
      title: 'fileName',
      dataIndex: 'fileName',
    },
    {
      title: 'actioin',
      key: 'action',
      render: (text: any, record: any) => (
        <a style={{ color: '#40a9ff' }} href={'http://localhost:1337' + record.filePath}>下载</a>
      ),
    },
  ]

  return (
    <>
      <UnorderedListOutlined
        onClick={showDrawer}
        style={{ position: 'absolute', top: '50px', right: '50px', fontSize: '30px', color: '#FFFFFF' }}
      />
      <Drawer title='文件列表' placement='right' onClose={onClose} visible={visible}>
        <Table columns={columns} rowKey='id' {...tableProps} style={{ height: '100%' }} />
      </Drawer>
    </>
  )
}

function App() {
  const eventBus = useEventEmitter()
  return (
    <div className='App'>
      <header className='App-header'>
        <UpLoadComponent eventBus={eventBus}></UpLoadComponent>
      </header>
      <BigfileList eventBus={eventBus}></BigfileList>
    </div>
  );
}

export default App;
