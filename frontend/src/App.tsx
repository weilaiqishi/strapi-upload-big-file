import React, { useState } from 'react';
import { Upload, message, Button } from 'antd';
import { RcFile }from 'antd/lib/upload';
import { UploadFile }from 'antd/lib/upload/interface';
import { UploadOutlined } from '@ant-design/icons';
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
  const beforeUpload = (file: RcFile) => { // 选中文件
    setfileList([...fileList, file])
  };
  const onRemove = (file: UploadFile) => { // 移除选中
    const index = fileList.indexOf(file as RcFile);
    const newFileList = fileList.slice();
    newFileList.splice(index, 1);
    setfileList(newFileList)
  }
  const handleUpload = () => { // 正式上传
    if (!fileList.length) return
    fileList.forEach(item => {
      const chunkList = createChunk(item)
      console.log(`handleUpload -> ${item.name} chunkList -> `, chunkList) // 看看chunkList长什么样子
    })
  }

  return (
    <>
      <Upload fileList={fileList} beforeUpload={beforeUpload} onRemove={onRemove} customRequest={() => { }}>
        <Button icon={<UploadOutlined />}>Select File</Button>
      </Upload>
      <Button
        type="primary"
        onClick={handleUpload}
        loading={uploading}
        style={{ marginTop: 16 }}
      >
        {uploading ? 'Uploading' : 'Start Upload'}
      </Button>
    </>
  )
}

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <UpLoadComponent></UpLoadComponent>
      </header>
    </div>
  );
}

export default App;
