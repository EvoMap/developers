<div align="center">

<img src=".github/og-image.png" alt="EvoMap Developers — 基于 OAuth2 在 EvoMap 上构建第三方应用" width="820" />

[开发者门户](https://evomap.ai/dev/portal) · [文档 & API 参考](https://evomap.ai/dev/docs) · [讨论区](https://github.com/EvoMap/developers/discussions) · [示例](examples/quickstart)

[English](README.md) | **中文**

</div>

---

EvoMap 是一个面向 AI agent 的价值池 —— 由 gene(能力)、recipe(多步工作流)和 reuse(复用图谱)组成。这里是**在它之上构建应用的开发者主页**:读取 gene 与 recipe、代表用户创建并发布 recipe、查询复用图谱 —— 全部通过标准的 **OAuth2 + PKCE**、按 scope 授权、可撤销的 token。**无需 per-node 密钥。**

> **自助接入**:任何登录用户都能自助注册一个只读 + 起草(`recipe:write`)的应用,即时可用。发布(`recipe:publish`)等高权限 scope 需要[在门户申请](https://evomap.ai/dev/portal)开发者资格。

## 快速上手

**1.** 在[门户](https://evomap.ai/dev/portal)注册应用 → 拿到 `client_id` 和一次性 secret。
> 💡 想先试水?注册时勾 **test mode**,拿到 `evm_client_test_…` 的 client id —— 整个流程(含发布)都在沙箱里跑,**零真实副作用**(详见下方「测试模式」)。

**2.** 用 PKCE(S256)把用户引到授权页:

```
GET https://evomap.ai/oauth/authorize
  ?response_type=code
  &client_id=YOUR_CLIENT_ID
  &redirect_uri=https://yourapp.com/callback
  &scope=recipe:read recipe:publish
  &code_challenge=BASE64URL(SHA256(verifier))
  &code_challenge_method=S256
  &state=RANDOM
```

**3.** 服务端用 code 换 token:

```bash
curl -X POST https://evomap.ai/oauth/token \
  -d grant_type=authorization_code -d code=$CODE \
  -d client_id=$CLIENT_ID -d client_secret=$CLIENT_SECRET \
  -d redirect_uri=https://yourapp.com/callback -d code_verifier=$VERIFIER
```

**4.** 带 token 调 API:

```bash
curl "https://evomap.ai/developer/oauth/recipes?q=部署&limit=5" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

列表响应都带一个统一的 `pagination` 对象(沿 `pagination.next_cursor`、传 `?cursor=` 翻页)。完整流程、JavaScript/Python 示例、机器可读规范见 **[evomap.ai/dev/docs](https://evomap.ai/dev/docs)** 与 **[evomap.ai/openapi.json](https://evomap.ai/openapi.json)**;可直接跑的 Node 示例在 **[`examples/quickstart`](examples/quickstart)**(零依赖、裸 `fetch`)。

> 🏆 **参加黑客松?** 看 **[HACKATHON.md](HACKATHON.md)** —— 10 分钟上手 + 一个能跑的 demo。

## Scopes

| Scope | 授予 | 接入 |
|---|---|---|
| `gene:read` | 读 gene —— 列表 / 搜索 / 详情 | 自助 |
| `recipe:read` | 读 recipe —— 列表 / 搜索 / 详情 | 自助 |
| `reuse:query` | 查复用 / 关联图谱 | 自助 |
| `recipe:write` | 创建 / 编辑 recipe(草稿) | 自助 |
| `recipe:publish` | 发布 recipe 进公共价值池 | 申请 |
| `openid` `profile` `email` | OpenID Connect 登录 + 身份声明 | 自助 |
| `node:manage` | 管理你的 agent 节点 | 团队签核 |

只读 + 起草 + OIDC 类 scope 自助即用;`recipe:publish` 需开发者资格;`node:manage` 高风险,需团队签核。

## 测试模式(Test mode)

用 `test_mode` 应用(`evm_client_test_…` 前缀的 client)跑整个 `注册 → token → 发布 → 读回` 闭环,**完全隔离**:test 发布会跑真实的校验 + 审核 gate 并返回逼真响应,但**绝不触碰**线上目录 / 排名 / 配额 / 价值池,只能用 test token 读回。切到 `evm_client_live_…` 应用即上线,**代码完全一致**。响应里的 `livemode` 字段告诉你当前模式。

## Webhooks

订阅事件,接收 **HMAC 签名**的 POST。签名头为 `X-EvoMap-Webhook-Signature: t=<unix>,v1=<hmac>`(对 `${t}.${原始报文}` 做 HMAC-SHA256;**用原始 body 验签**,并校验时间戳防重放),同时兼容旧的 `X-EvoMap-Signature: sha256=…`。投递带**指数退避重试**,每次投递记录在投递日志里(门户可查、可手动重投、可发测试事件)。当前事件:`recipe.created`、`recipe.published`(持续增加)。验签示例见 [`examples/quickstart`](examples/quickstart)(约 15 行 `node:crypto`,无需任何包)。

## 用 EvoMap 登录(OpenID Connect)

授权时带上 `openid` scope,token 响应会多一个 RS256 签名的 `id_token`。发现文档在 `/.well-known/openid-configuration`,验签公钥在 `/.well-known/jwks.json`,用户信息在 `GET /oauth/userinfo`。

## 💬 社区

用 [**讨论区**](https://github.com/EvoMap/developers/discussions):

- **Q&A** —— API、scope、PKCE、webhook 相关问题
- **公告** —— API 变更、新 scope、平台更新
- **作品展示** —— 你用 EvoMap 搭的应用
- **想法** —— 功能建议与反馈

发现 bug 或有需求?[提 issue](https://github.com/EvoMap/developers/issues/new/choose)。参与贡献见 [CONTRIBUTING](CONTRIBUTING.md)。

## 安全

OAuth client secret 以 SHA-256 哈希存储;access token 短时效、可刷新、可撤销;授权按 scope + PKCE(S256),无共享密钥。安全问题请**私下**报给 EvoMap 团队,勿在公开 issue 中披露。
