# miaojian backend 技术博客计划

## 项目概况
- 位置：/Users/zhaozhibo/Project/miaojian/backend
- 规模：2388 个 Go 文件，226MB
- 框架：svrkit-go（腾讯内部 Go 服务框架），protobuf 定义接口

## 模块清单（按规模）

| 模块 | Go 文件数 | 定位 | 博客规划 |
|---|---|---|---|
| mmvsimplelogicsvr | 562 | 核心业务逻辑层（最大） | 按核心功能拆多篇 |
| mmvmaassvr | 322 | MaaS（模型即服务） | 1-2 篇 |
| mmvmanagemqworkersvr | 318 | 管理端 MQ 消费者 | 1 篇 |
| common | 205 | 公共库 | 1 篇（基础设施综述） |
| mmvletsseesvr | 183 | - | 1 篇 |
| mmvmaaspartnerbroker | 139 | 合作伙伴 broker | 1 篇 |
| mmvtemplatecreatorsvr | 137 | 模板创作 | 1 篇 |
| thirdparty | 113 | 下游依赖封装 | 1 篇（依赖地图） |
| mmvopenlogicsvr | 97 | 开放平台逻辑 | 1 篇 |
| mmvvideocreatorsvr | 87 | 视频创作 | 1 篇 |
| mmvwecamsvr | 66 | - | 1 篇 |
| gateway | 63 | 网关 | 1 篇 |
| mmvnlpsvr | 38 | NLP | 1 篇 |
| mmvsearchsvr | 27 | 搜索 | 1 篇（或小模块合并） |
| mmvmiaojianbrokersvr | 18 | broker | 小模块，可合并 |
| mmvmqworkersvr | 9 | MQ worker | 小模块，可合并 |

## mmvsimplelogicsvr 核心功能域（待确认后拆分）
service/ 下 60+ 子域，初步归类：
- 素材域：material, image, video, videoprocessing, avprocess, smartclip*, voice2txt, speech
- 模板域：template*, templatecreator, templateannotation, tagmanage, projectclass
- AI 域：aigc, aivideo, llm, llmwiki, mmbizimggeneralmodelzoo
- 音乐域：music, musicbeats, qqmusic, snssong, finderfeedsong
- 分发域：finder, release, replay, notification, wechatopen
- 平台域：permission, security, spamblackcheck, personalconfig, cloudconfig
- 任务域：schedulefixedtask, cron, dynamicroute

## 输出要求
1. 技术博客风格：少贴模块名/变量名/代码段，重点讲工作流程和技术手段
2. 缺失的下游依赖要单独输出可读的结果文件
3. 每篇要有可视化流程图/表格
4. 最终放到前端页面展示并测试
