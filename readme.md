# 大文件上传

使用 strapi.js 和 React 实现大文件上传

## 大致流程

1. 前端接收BGM并进行`切片`
2. 将每份`切片`都进行`上传`
3. 后端接收到所有`切片`，创建一个`文件夹`存储这些`切片`
4. 后端将此`文件夹`里的所有切片合并为完整的BGM文件
5. 删除`文件夹`，因为`切片`不是我们最终想要的，可`删除`（可以保留进行大文件分片下载）
6. 当服务器已存在某一个文件时，再上传需要实现`“秒传”`

## 起步

创建一个strapi后端项目

```bash
yarn create strapi-app backend --quickstart
```

创建一个React前端项目

```bash
yarn create react-app frontend --template typescript
cd frontend
yarn add antd axios
```

## 实现

### 前端实现切片

在浏览器中上传文件时，选中文件后这个文件转成一个Blob对象，而这个对象的原型上上有一个slice方法，
这个方法是大文件能够切片的原理，可以利用这个方法来给打文件切片

front/src/App.tsx

```tsx
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
    // 使用slice方法切片
    chunkList.push({ file: file.slice(cur, cur + size) })
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
```

选中一个157MB的文件，被切成32个5MB的分片

![fileslice](./showImg/1fileslice.png)
