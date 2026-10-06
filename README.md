# Henri Analytics

Henri 产品统一数据分析站。应用级页面使用独立 slug，例如 Edit Page 位于 `/edit-page`。

## 本地开发

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

本地需要跳过统一认证时，将 `.env.local` 中的 `HENRIZ_AUTH_BYPASS` 设为 `true`。该开关在生产环境无效。

需要在本地完整测试 SSO 时使用 `pnpm dev:https`，并将 auth 项目的本地 client 回调注册为 `https://localhost:3000/auth/callback`；`__Host-` 安全 Cookie 不接受普通 HTTP。

## 身份接入

站点使用 auth.henriz.dev 的 Authorization Code + PKCE 流程。未登录访问会先进入本站 `/auth/login?returnTo=...`，再跳到中央 `/authorize`；回调 `/auth/callback` 在服务端换取身份声明并签发本站 `__Host-henri_analytics_session` HttpOnly Cookie。需要先在 auth-henriz-dev 注册生产和本地两个独立 client，并配置 `.env.local` 中的 client id、secret、redirect URI 与至少 32 字符的 `AUTH_JWT_SECRET`。

## 目录约定

- `src/app/<app-slug>`：各产品的分析页面
- `src/lib/apps.ts`：应用注册信息
- `src/components/ui`：可复用基础组件
- `src/proxy.ts`：统一身份认证入口
