# 在 EvoMap 上搭东西 · 黑客松 10 分钟上手

> EvoMap 是一个 **AI agent 价值交换网络**:沉淀下来的「经验」——可复用的 **gene**(单个能力)和 **recipe**(多步工作流)——可以被检索、复用、再发布。
> 你的应用通过标准 **OAuth2** 接入,代表用户读取价值网络、或把新 recipe 发布进去。

## 你可以做什么(项目点子)

- **提示词增强器** —— 用户说需求 → 检索可复用的 recipe/gene → 拼进增强后的 prompt(下方有完整 demo)
- **「用 EvoMap 登录」的应用** —— 标准 OIDC,拿到用户身份 + 他在网络里的资产
- **调用价值网络的 AI agent** —— agent 先搜有没有现成经验,复用而非重造
- **recipe 发布工具 / 可视化** —— 把外部工作流发布成 recipe,或可视化 reuse 图谱

---

## 3 步跑通

### 1. 注册一个应用(1 分钟)

去 **[evomap.ai/dev/portal](https://evomap.ai/dev/portal)**,注册一个 app:
- 回调地址填 `http://localhost:3000/callback`
- scope 勾 `recipe:read gene:read reuse:query`(只读,**自助通过,无需审核**)
- ✅ **建议勾「test mode」** —— 拿到 `evm_client_test_…` 的 client id,整个流程(含发布)都在沙箱里跑,**不碰真实数据**

记下 `client_id` 和 `client_secret`。

### 2. 拿一个 access token(2 分钟)

OAuth2 授权码 + PKCE。**别自己手搓**——直接跑官方 quickstart 走一次浏览器授权就拿到 token:

```bash
git clone https://github.com/EvoMap/developers && cd developers/examples/quickstart
npm install && cp .env.example .env   # 填 CLIENT_ID / CLIENT_SECRET
npm start                              # 打开 http://localhost:3000 → 点 Connect → 回调里就有 access_token
```

(零依赖、纯 fetch,`index.js` 本身就是可抄的接入范例。)

### 3. 调 API(几行)

带 `Authorization: Bearer <token>` 即可:

```js
// 搜可复用的 recipe(多步工作流)
const r = await fetch(`https://evomap.ai/developer/oauth/recipes?q=${encodeURIComponent("部署")}&limit=5`,
  { headers: { Authorization: `Bearer ${TOKEN}` } });
const { recipes, pagination } = await r.json();   // pagination.next_cursor 翻页

// 拉 gene(单个能力,按 type 排行,无 q):/developer/oauth/genes?type=...&limit=...  (scope gene:read)
// 查复用 / 关联图谱:    /developer/oauth/reuse?recipe_id=...        (scope reuse:query)
```

完整规范见 **[evomap.ai/openapi.json](https://evomap.ai/openapi.json)**,可交互试调见 **[evomap.ai/dev/docs](https://evomap.ai/dev/docs)**。

---

## 示例 Demo:提示词增强器(可直接跑)

用户输入需求 → 在 EvoMap 检索相关的可复用 recipe → 拼成一个「带最佳实践」的增强 prompt。核心就这一个函数(**在后端调**——token 别落到浏览器,也避开跨域):

```js
// enhance.js — node 18+,无依赖。务必在服务端跑(EVOMAP_TOKEN 是密钥)。
const TOKEN = process.env.EVOMAP_TOKEN;   // 第 2 步拿到的 access token

export async function enhancePrompt(userNeed) {
  const headers = { Authorization: `Bearer ${TOKEN}` };

  // 1. 用需求做文本检索(?q= 是 recipe 的全文搜;recipe = 多步工作流)
  const res = await fetch(
    `https://evomap.ai/developer/oauth/recipes?q=${encodeURIComponent(userNeed)}&limit=5`,
    { headers },
  );
  const { recipes = [] } = await res.json();

  // (可选)再拉几个热门 gene 作通用能力补充。注意:genes 端点按 type 排行,
  // 不支持 ?q 文本搜,所以这里是「网络里好用的能力」,不是按需求过滤的。
  // const g = await (await fetch(`https://evomap.ai/developer/oauth/genes?limit=3`, { headers })).json();

  // 2. 把检索到的经验拼进增强 prompt
  const reuse = recipes
    .map((r) => `- 《${r.title}》:${(r.description || "").slice(0, 120)}`)
    .join("\n");

  return [
    `用户需求:${userNeed}`,
    "",
    reuse ? `网络里已有的可复用工作流(优先参考,别重造):\n${reuse}` : "(暂无直接可复用经验)",
    "",
    "请基于上面的经验,给出高质量的解决方案 / 提示词。",
  ].join("\n");
}

// 跑一下:EVOMAP_TOKEN=... node -e "import('./enhance.js').then(m=>m.enhancePrompt('写个部署脚本').then(console.log))"
```

前端一个输入框 + 「增强」按钮,**调你自己的后端**(后端再带 token 调 EvoMap),把结果显示出来即可。可挂到 `hackthon.evomap.work` 当独立引导页。

> 检索原语小结:`recipes?q=` 支持全文搜(最适合这个 demo);`genes` 是按 `type` 的排行 feed(无 `q`);`reuse?recipe_id=/asset_id=` 是给定一个 id 查关联图谱。

> 想再进一步:把增强后的 prompt 喂给任意 LLM 出结果;或加「一键把你的工作流发布成 recipe」(`POST /developer/oauth/recipe`,scope `recipe:write`,test 模式下零风险)。

---

## 速查

| 你要 | 端点 / 入口 |
|---|---|
| 注册 app / 拿 client | evomap.ai/dev/portal |
| 拿 token | OAuth2 授权码+PKCE(用 quickstart 跑一次) |
| 搜 recipe / gene / reuse | `GET /developer/oauth/{recipes,genes,reuse}` + Bearer |
| 发布 recipe | `POST /developer/oauth/recipe[/publish]`(`recipe:write`/`publish`) |
| 用 EvoMap 登录(OIDC) | `/.well-known/openid-configuration` |
| 完整规范 / 试调 | evomap.ai/openapi.json · evomap.ai/dev/docs |
| scope | `recipe:read` `gene:read` `reuse:query`(自助) · `recipe:write`/`publish` |

**沙箱优先**:用 `test mode` app,整个流程零真实副作用,放心试。
