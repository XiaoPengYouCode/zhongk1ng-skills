# trip-planner

## 这是什么

把火车票 + 机票实时查询和请假成本模型放在一起，给私人出行算出一个最优方案和少量备选。核心思路：票价、请假损失、换乘折腾统一折成钱，按总经济成本排序。

## 怎么用

### 前置依赖

**火车票**：需要拉通 12306 实时余票。任选其一：

- [12306-mcp](https://github.com/Joooook/12306-mcp) -- 推荐，直接走 MCP 查余票、下单
- [12306 Train Assistant](https://termo.ai/skills/12306-train-assistant) -- 走浏览器自动化
- 都没有时，会退到通用浏览器自动化直连 12306

**机票**：需要 Tuniu Flight 的 API Key：

1. 去 Tuniu 开放平台申请 `TUNIU_API_KEY`
2. 机票链路优先用 `searchLowestPriceFlight`，入围后再用 `multiCabinDetails` 做下单校验
3. 没有 Key 时会退到浏览器自动化查实时订票页，但速度和覆盖面都不如直接走 API

### 安装

```bash
ln -s /path/to/trip-planner ~/.claude/skills/trip-planner
```

### 使用

```
/trip-planner 4月30号深圳去常州，5月5号回
```

没给全的字段（日薪、行李、上班时间等）会按默认值补齐。

### 输出

- 一个推荐方案 + 为什么它最划得来
- 1 到 2 个备选
- 每个方案的票价、请假成本、总经济成本、官方可售状态
