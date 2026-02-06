// 在构建前下载所有组件文档并保存为 JSON
const { NaiveUIMetadataExtractor } = require('../out/metadata')
const fs = require('fs')

async function prebuild() {
  console.log('正在删除久版缓存文件')
  fs.rmSync('./cache/', { recursive: true, force: true })

  console.log('📥 预下载 Naive UI 组件文档...')

  const metadataExtractor = new NaiveUIMetadataExtractor(true)

  // 保存到 server/data/components.json
  metadataExtractor.initialize()
}

prebuild()
