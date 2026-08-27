# 昼刻 Daymark

一款面向学习与深度工作的专注管理产品，将翻页时钟、待办倒计时、日时间轴、周课表和全年热力图整合为连续的专注闭环。

## 在线体验

https://daymark-focus.mijinpeng7.chatgpt.site

## 核心功能

- 翻页时钟与 25 / 45 / 60 / 120 分钟任务倒计时
- 暂停、继续、提前结束、放弃等完整计时状态
- 提前结束按实际专注时长统计，暂停时间不计入
- 当日时间轴与前后日期查看
- 一周课表式专注纵览与补记专注
- 12 个月全年热力图，三档颜色表示专注强度
- Supabase 邮箱账号与网页、App 多端自动同步
- Capacitor 跨端封装，可构建 Android 与 iOS 工程

## 技术栈

- HTML / CSS / JavaScript
- Vite
- Capacitor
- Supabase Auth + PostgREST + Row Level Security

## 本地运行

```bash
npm install
npm run dev
```

打开 `src/cloud-config.js`，填写自己的 Supabase Project URL 与 Publishable Key；然后在 Supabase SQL Editor 中执行 `supabase/schema.sql`。

## 构建

```bash
npm run build
npm run native:sync
```

## 项目背景

项目最初是适配平板的翻页时钟，随后根据真实使用反馈逐步增加任务倒计时、时间复盘、热力图和多端同步。产品重点不是堆叠功能，而是降低开始成本，并让长期投入可见。

