# StockCal Web

StockCal 的 Web-first 前端，使用 Next.js App Router 和 TypeScript，面向手机浏览器与桌面浏览器。

## 本地运行

```bash
npm install
cp .env.example .env.local
npm run dev
```

默认访问 http://localhost:3000。STOCKCAL_API_BASE_URL 指向本地或阿里云上的 Spring Boot API；行情和 AI 密钥只配置在后端。

## 验证

```bash
npm run lint
npm run test
npm run build
```

Playwright 路径使用 npm run test:e2e，需要先启动开发服务。

## 部署

生产环境优先使用 Docker 部署到阿里云；Vercel 用于个人非商业 Preview。详细边界见仓库中的 Web-first 设计和部署文档。
