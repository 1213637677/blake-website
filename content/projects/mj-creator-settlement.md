---
title: 秒剪创作者中心
summary: 创作者提交视频时只能给出本地文件指纹，结算却必须绑定到视频号的实体 ID。这个天然延迟的跨系统绑定靠三层兜底收敛，收益过 7 天冻结期再复查一次才落账，全程 11 个状态、19 种迁移动作都留痕。
date: 2026-10-14
kind: work
role: 后端设计与实现
period: '2024 — 至今'
status: active
stack:
  - Go
  - MySQL
  - Redis
  - GORM
tags:
  - 秒剪
  - 创作者中心
  - 结算
featured: true
links: []
---

## 这个系统做什么

秒剪创作者中心是给秒剪里的创作者用的结算平台：运营在后台发布有奖征稿活动，创作者用视频号报名、用秒剪剪完发到视频号、运营审核、按月出账单、打款。

我负责的是这套系统的服务端，主体是一个独立的 Go 服务，挂在秒剪的网关后面。除了征稿活动本身，账号入驻审核、创作者标签、邀请码、教程课程、站内信、月度账单也都在里面。核心是那条**从领取到打款**的主链路，其余模块围着它转。

之所以值得单独写一篇，是因为这条链路里几乎每一个环节都不是"写库就完事"：跨系统的数据要靠重试去收敛，钱要等七天才能确认，每一个状态变化都要能追溯到人和时间。

## 先说最难的那个约束

创作者在秒剪里剪完视频，直接分享到视频号。这个过程跨应用，秒剪**拿不到视频号返回的实体 ID（objectID）**，客户端能上报的只有本地视频文件的哈希。

但奖励必须绑定到 objectID。没有它，就无法验证这条视频是否真实存在、是否公开、有没有被判违规——后续审核和风控全部无从谈起。

更麻烦的是，视频号侧的索引有延迟。刚发布的视频，拿哈希去查，短时间内就是查不到。这不是抖动，是**确定性的延迟**。

这个约束把整条链路的设计带偏了方向：**"重试"在这里不是容错手段，而是主流程的一部分**。系统必须假定"第一次一定查不到"，把等待做成常态。

## 状态流转

先看全景。一次参与（execution）有 11 个状态，迁移动作 19 种：

![参与状态流转](/diagrams/11-exe-state.svg)
*参与状态流转*

### 主链路

`Working 执行中` → 创作者提交，带上 fileHash，进入 `Submitted 已提交`。这时候系统还没有 objectID。

绑定成功后进入 `Auditing 审核中`，运营在后台看视频决定是否通过：

- 通过 → `Approved`，进入 7 天冻结期
- 不通过 → 没到次数上限就是 `Denied`，创作者可以改完重提；**累计拒绝 2 次**（`MaxSubmitCount`）就是 `Failed`，彻底失败，这个活动不能再领

冻结期结束后复查视频状态，没问题就到 `Accounting 待出账`，次月出账。

### 那些"退回去"的分支

真正花时间的是各种失败和回滚路径。这里有个设计我后来觉得是对的：**退回时不是无脑失败，而是先判断活动过期没有**。

```go
if time.Now().Before(*task.ExpireTime) {   // 未超过截止时间
    exe.Status = consts.ExeStatusAppliable // 可重新领取
} else {
    exe.Status = consts.ExeStatusExpired   // 已过期
}
```

未过期就回到 `Appliable（可重新领取）`，创作者还能再来一次；过期了才是 `Expired`。放弃任务、冻结期复查发现视频被删、后台判定"根本没发到视频号"，走的都是这套判断。

对创作者来说这两者体感差别很大：一个是"还能补救"，一个是"这期结束了"。能用同一段代码表达这个语义，比在各处散落 if 要好维护得多。

### 关于 Appliable：为什么不新建记录

创作者放弃或者被退回之后重新领取，**复用同一条 execution 记录**，只改状态：

```go
if exist != nil {   // 用户以前放弃过任务
    exe = exist
    exe.Status = consts.ExeStatusWorking
} else {
    exe = &model.VideoCreatorTaskExecution{ ... }
}
```

这么做是被业务倒逼的：一个 unionID 对同一个活动只能领一次，如果用新记录，"是否领过"就得靠历史记录去反查，很快会变成一堆难以维护的判重逻辑。复用记录之后，`(union_id, task_id)` 上直接就是唯一的一行。

代价是重新领取时必须把上一次的残留清干净——fileHash 置空、查重状态重置、朋友圈截图和文案清空。这些清理写在放弃和退回的分支里，漏一个就会串味。这是个偏实用的取舍，不是优雅方案。

### 过期不是实时算的

`Expired` 这个状态**数据库里不会自动更新**，靠每分钟跑一次的定时任务批量刷。注释里写得很直白：`任务过期, 数据库不会实时更新`。

这是明确接受的设计。实时计算过期意味着每次查询都要拿当前时间去比，扫全表的代价远高于每分钟刷一遍。代价是在两次执行之间，状态是滞后的。活动还专门有个 `expire_cleaned` 字段标记"这批已经刷完了"，避免重复处理。

顺带一提，把定时清理和在线服务拆成了两个进程——`offline/main` 独立部署，只跑 gocron 的任务和延迟队列消费。出账单这种重活不会拖慢创作者侧的在线接口。

## 文件指纹三层兜底

![文件指纹三层兜底](/diagrams/09-bind-flow.svg)
*文件指纹三层兜底*

| 层 | 做法 |
|---|---|
| 第一层 | 投进延迟队列，每 5 分钟重试，最多 24 次（约 2 小时） |
| 第二层 | 每天一次的定时扫描，补偿重试也没绑上的 |
| 第三层 | 后台人工绑定 |

### 消费端：区分错误性质再决定要不要确认

延迟队列返回 `true` 表示确认（ACK），`false` 表示重来。整个判断只有一条原则：**重试解决不了的才确认**。

```go
msg := new(confirmVideoMsg)
err := json.Unmarshal([]byte(msgString), msg)
if err != nil {
    return true   // 消息格式错了，重试一百次也一样，直接 ACK
}
```

反过来，远程调用失败必须返回 `false`：

```go
ret := miaojianBrokerCli.GetFinderVideoByMD5(...)
if ret != 0 {
    return false  // 说不定下次就好了
}
```

这条判断看着简单，但它是整个兜底能不能成立的关键。如果把可恢复的错误也确认掉，任务就静默丢失了——创作者提交了视频，系统在后台悄悄放弃，没人知道。

### 有穷尽

重试 24 次之后不再自动处理，转人工扫描和后台绑定。**重试必须有上界**，否则一条永远查不到的视频会无限占用队列资源。`maxTryCount = 24` 配合 5 分钟间隔，覆盖约 2 小时，这个数字是拍的——视频号侧的索引延迟分布我这边看不到，只能按经验定。

第二层的定时扫描扫的是 `status = Submitted` 的全部记录，注释里解释了为什么**不按时间范围过滤**：`只要是提交状态的都可以绑定，防止出现任务截止时间延长导致不能自动绑定等情况`。运营把活动截止时间往后调是常规操作，按时间过滤会把这些漏掉。

### 幂等

绑定函数 `ConfirmTaskVideo` 的注释写着"此函数全局并发安全且幂等"。幂等的实现方式是**状态前置校验**：

```go
if exe.Status != consts.ExeStatusSubmitted {
    return errors.InvalidForm("task exe %d is not waiting video", exe.ID)
}
```

不是 submitted 就直接返回。延迟队列重试、定时扫描、后台人工绑定，三个入口都调这一个函数，谁先成功后面的都是空转。

## 收益冻结期：7 天后复查一次

审核通过不立刻结算。等 7 天，**再查一次视频状态**——有没有被删、有没有改成私密、有没有被判违规。

防的是"拿完奖励就删视频"。这个模式在内容激励里很常见，实现方式是延迟复查：

```go
f, err := finder.GetFinderObjectById(exe.ObjectID)
extra.IsDelete = f.GetFlag().GetIsDelete()
extra.IsPrivate = f.GetFlag().GetIsPrivate()
extra.SpamFlag = f.GetFlag().GetSpamFlag()
```

违规判定用位掩码区分了"仅自己可见"和"所有人不可见"两种处置：

```go
if exeExtra.SpamFlag&consts.FinderPostSpamFlagBanSelfSee != 0 ||
   exeExtra.SpamFlag&consts.FinderPostSpamFlagBanAllNoSee != 0 {
```

命中就撤销收益，并且**发短信告诉创作者具体原因**——是删了、私密了、还是违规了，文案各不相同。这点我觉得值得记：风控动作一定要给明确反馈，否则创作者只会觉得"平台吞了我的钱"。

### 冻结期终点怎么算

这里有个细节值得单独说。`finish_time` 不是"审核通过时间 + 7 天"，而是**"视频号发布时间 + 7 天"**：

```go
finishTime := exe.SubmitTime.Add(consts.TaskExeFrozenDuration)  // 7 * 24h
exe.FinishTime = &finishTime
```

而且进入结算时**不修改 finish_time**，源码里留了注释解释原因：

```go
// 不修改 FinishTime, 以过审时间 + 7 * 24 小时为准.
// 防止因为执行时间误差导致延迟到下个月结算
```

如果按"实际执行时刻"写 finish_time，定时任务晚跑几分钟就可能把本月的收益推到下个月的账单里。以发布时间为锚点是确定性的，不受调度抖动影响。

## 出账：按月归集，三个时间概念

![结算时间线](/diagrams/12-settlement-timeline.svg)
*结算时间线*

账单这块最容易搞混的是**三个不同的时间**：

1. `submit_time` —— 视频在**视频号发布**的时间，不是审核通过的时间。冻结期按它算。
2. `finish_time` —— 冻结期结束的时刻 = `submit_time + 7 天`。
3. `bill.month` —— 这个视频算哪个月的账，**按 submit_time 归月**。

出账的定时任务每月 8 号跑，扫上个月区间内 `status = Accounting` 且还没关联账单的记录：

```go
Where("status = ? and submit_time >= ? and submit_time < ? and (bill_id is null or bill_id = 0)",
    consts.ExeStatusAccounting, since, to)
```

`bill_id is null or bill_id = 0` 这个条件就是幂等的落点——**已经关联过账单的记录不会再被扫到**，重跑不会产生第二张账单。函数的注释也写明了这个契约：`此函数的执行可能会被中断, 必须保证幂等和可重入`。

8 号这天连着跑了三次（10 点、11 点、12 点）：

```go
gocron.Every(1).Day().At("10:00").Do(...)
gocron.Every(1).Day().At("11:00").Do(...)
gocron.Every(1).Day().At("12:00").Do(...)
```

注释写着"重试两次防止失败"。月度出账一年只有 12 次机会，一次失败要等一个月，多跑两遍的成本可以忽略。

账单生成后还有个 `visible_since`，次月 10 号才对创作者可见——留出打款和对账的窗口，避免创作者看到金额但钱还没到。

## 并发控制

### check-lock-check

所有改变状态的操作都是同一个套路：**加锁，拿锁后重新读一次，再校验状态**。

```go
lock, err := helper.LockUnionID(exe.UnionID)
defer func() { _ = lock.Release(context.Background()) }()

/* double check */
exe, err = taskDao.GetExeByID(req.GetExeID())
if exe == nil || exe.Status != consts.ExeStatusAuditing {
    return errors.NotFound("已撤销或已完成审核")
}
```

第一次读是为了拿到 unionID（锁的粒度是 unionID），第二次读才是真正用于判断的数据。因为等锁期间状态可能已经被别的请求改了，不重读就是基于过期数据做决策。

锁的粒度选择是**unionID 而不是 finderUin**，helper 里专门注释了：`所有对账户的操作直接锁定 unionID, 不要锁定 finderUin`。

锁时长只有 2 秒，配合线性退避最多重试 10 次：

```go
RetryStrategy: redislock.LimitRetry(redislock.LinearBackoff(100*time.Millisecond), 10)
```

这说明临界区必须很短——锁里只做状态校验和一次事务写，绝不放在里面调远程接口。

### 数据库行锁补位

Redis 锁是跨进程的第一道防线，限量活动的库存扣减还要靠数据库行锁兜底：

```go
err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&task, execution.TaskID).Error
```

然后走条件更新而不是"先查再写"：

```go
row := tx.Model(videoCreatorTaskModel).
    Where("id = ? and join_count < ?", execution.TaskID, taskExtra.Count).
    Update("join_count", gorm.Expr("join_count + ?", 1))
if row.RowsAffected == 0 {
    return errors.NotFound("任务参与人数已达上线")
}
```

`join_count < count` 这个条件写在 SQL 里，靠 `RowsAffected` 判断是否抢到名额。如果先查后写，两个请求同时读到"还剩 1 个"就都放行了。

放弃任务的时候反向扣减，同样写在事务里。

### 状态和历史在同一个事务里

`UpdateTaskExecution` 把 execution 的更新和 history 的插入放在一个事务里。要么状态变了且有记录，要么都没发生。不会出现"状态改了但没留痕"——对结算系统来说，没有记录的状态变更等于说不清。

## 审计：每一笔迁移都留痕

`VideoCreatorTaskExecutionStateHistory` 记录每一次状态迁移：变化后的状态、动作类型、操作人、objectID，以及一个 JSON 扩展字段存当时的上下文（审核意见、拒绝次数、视频描述、截图、查重结果）。

这是朴素版的事件溯源。做结算业务，"什么时候、谁、把状态从什么改成了什么"是刚需——创作者来问"我的钱为什么没到账"，唯一能回答的就是这张表。

除了落库，每次迁移还会往 atta 上报一份，带价格、拒绝次数、是否邀请来的等字段，用于做数据看板。

扩展字段用的是 JSON mixin，通过 GORM 的 `AfterFind` 钩子自动反序列化：

```go
func (e *VideoCreatorTaskExecution) AfterFind(tx *gorm.DB) error {
    extra := new(VideoCreatorTaskExecutionExtra)
    return e.JsonMixin.Init(extra)
}
```

业务字段变动频繁（审核意见、各种标志位），用 JSON 省掉大量 migration。代价是这些字段没法做索引和 SQL 过滤，所以**需要查询和索引的字段一定是独立列**（status、file_hash、object_id、submit_time、finish_time 都有索引），JSON 里只放展示用的东西。这个边界在一开始就得划清楚，后期迁移很痛。

## 几个值得单独记的点

### 一个容易被忽略的坑：放弃任务要清 fileHash

```go
// 放弃任务后，将 file_hash 置空，防止其他任务提交相同视频后绑定失败
exe.FileHash = ""
```

如果不清，同一个创作者放弃后又提交了同一段视频，fileHash 相同，绑定时按哈希查 execution 就会命中旧的记录。这种"数据残留导致的跨任务污染"很隐蔽，测试时不容易覆盖到。

### Redis 映射表的自愈

客户端提交视频时只有 `ilinkUin`（端上的登录标识），没有 unionID。所以 Redis 里维护了一张 `ilinkUin → exeID` 的映射。

这张表是缓存，可能整体丢失。处理方式是在每次读写前检查 key 是否存在，不存在就**从数据库重建**：

```go
func checkAndRebuildIlinkExeMap() (bool, error) {
    ret, err := app.RedisCli.Exists(ctx, ilinkUinExeMapKey).Result()
    if ret > 0 {
        return false, nil   // 存在，无需重建
    }
    /* 加锁防止并发重建 + check lock check */
    ...
}
```

重建时从数据库捞所有 `status = Working` 的记录，关联出 unionID → ilinkUin，一次性写回。这里也用了 check-lock-check，防止多个协程重复重建。还塞了个 `"0": "0"` 占位符防止缓存击穿。

### 消息通知不能拖慢主流程

审核通过、拒绝、冻结期撤销，都要给创作者发短信。这些调用全部扔进 goroutine，并且带 recover：

```go
go func() {
    defer func() {
        if err := recover(); err != nil {
            log.Error("sendVideoInformSms failed, error: %v", err)
        }
    }()
    sendVideoInformSms(c, msg, exe.UnionID)
}()
```

短信是旁路，失败不能影响状态流转。所有定时任务的入口也都有 recover——一个 panic 不能让整个 cron 进程挂掉。

### 登录态

客户端拿 JWT 换取身份，payload 里再套一层 AES 加密：

```go
func ParseTicket(c *gin.Context, jwtString string) (*EncryptPayload, error) {
    if val, ok := c.Get(EncryptedTicketKey); ok && val != nil { ... }  // 命中上下文缓存
    claims, err := parseJWT(jwtString)
    payload, err := decryptPayload(claims.EncryptedData)
    c.Set(EncryptedTicketKey, payload)
    return payload, nil
}
```

身份证号、银行卡号这类敏感信息单独加密存储（`NewCitizenNo`、`NewAccount`），加密密钥和 JWT 密钥分开。有效期 3 天——因为有端上的登录态，不需要频繁刷新。

### 账号注销的拦路检查

创作者申请注销时，先检查有没有未结算的钱和进行中的活动，有的话把具体原因返回给前端：

```go
ok, err := taskDao.HasUnsettleExe(ticket.UnionID)
if ok {
    // "创作收入尚未结清" / "有正在参与中的活动"
}
```

这看着是个小功能，但缺了它就会出事故：账号注销了钱还没结完，或者活动还挂着人没了。注销走的是"申请待删除"的中间状态，不是直接删，15 天后才真正清理。

## 后台与管理端

运营侧的后台也是这个服务的一部分。除了审核视频，还有：

- 活动的增删改、暂停/恢复、手动排序（有独立的 `position` 表支持运营随时调顺序）
- **限量活动**：`is_limit_count` + `count`，靠前面说的行锁扣减
- **标签定向**：活动带 `level_tags` / `domain_tags`，创作者带标签，取交集决定可见性。标签为空代表不限
- 邀请码管理，可查"用了多少次、通过多少人"
- CSV 导出：视频明细、账单明细、账号审核记录
- 视频查重结果查看（帧级别相似度由外部服务回写）

活动排序这里有个细节：分页**不能**用"上一页最后一个 ID"做游标，因为运营会随时调整顺序，游标会失效。改成客户端把已展示的 ID 列表回传，服务端做差集。

## 背景与约束

**为什么客户端只能给文件指纹**。创作者在秒剪里剪完直接分享到视频号，跨应用拿不到返回的实体 ID。这是产品链路决定的客观限制，不是设计选择。

**为什么绑定天然有延迟**。视频号侧需要时间建立索引，刚发布查不到是正常现象。所以重试是主流程而非容错。

**为什么一个 unionID 同时只能进行一个活动**。运营侧的诉求是控制单个创作者的产出节奏，同时简化状态判断——只要有一个未完成的 execution 就不能领新的。代价是放弃了"多任务并行"的可能。

**为什么每月只能参加 30 次**。`MaxMonthTaskCount = 30`，配合"同一活动只能领一次"，防止批量刷量。

**结算的可靠性要求**。涉及真金白银，丢失或重复都不可接受。这解释了为什么要三层兜底 + 完整历史 + 处处幂等 + 事务内写状态。

## 还能怎么优化

**三层兜底仍有缺口**。如果视频号索引延迟超过 2 小时，或者视频被平台判定异常导致永远查不到，就只能人工。应该加"长期未绑定"的监控告警，而不是被动等人工发现——现在是靠运营自己去后台翻。

**过期状态靠定时批量刷有窗口**。两次执行之间状态是滞后的。如果这个状态会直接展示给用户，展示时应该实时算一下。

**7 天冻结期和 30 次月度上限是硬编码常量**。这类业务规则应该可配置化，便于根据作弊情况动态调整，不然改一次要发一次版。

**拒绝次数上限的语义可以更清楚**。`MaxSubmitCount = 2` 现在是"累计拒绝 2 次即失败"，但创作者视角看到的是"还能改几次"，这两个数字的换算在前端和后端各写了一遍，容易对不上。

**查重结果目前只展示不拦截**。相似度算出来存进扩展字段，供运营人工看，没有自动拦截逻辑。如果后续要自动化，需要一个阈值策略和申诉通道，光有数据不够。

**账单可见时间是硬编码**。`VisibleSince` 算的是次月 10 号，这个 10 天窗口的假设（打款需要多久）应该来自配置或者实际打款状态，而不是常量。

## 补充说明：本模块读不到的部分

- **视频号侧的反查接口实现不可见**——只能看到调用与结果处理，无法确认索引延迟的具体分布，因此 5 分钟 × 24 次的参数是基于经验而非实测
- 视频状态复查依赖视频号接口，其判定逻辑不可见；`spam_flag` 的完整语义也没有文档
- 实际打款环节的第三方转账实现不在本仓库，账单状态推进到"已结算"的接口目前是关闭的
- 查重（视频相似度）的计算由消息消费端回写，算法不在本服务内
- 客户端如何用 `ilinkUin` 换取提交入口的完整链路不可见，只看到服务端的映射查询
