# 刘景维—吴双妍联合培养课题组网站

这是课题组的静态公开网站。日常维护只需更新数据文件后重新构建并核验。

## 常用命令

在项目目录运行：

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run verify
npm.cmd run check
npm.cmd run serve
```

`build` 会生成可部署文件到 `dist`；`verify` 检查其中的页面、链接、公开信息和资源；`check` 依次执行测试、构建和核验。`serve` 会在本机启动预览，浏览器访问终端显示的 `http://localhost:xxxx/` 地址即可查看。

## 更新内容

- 成员名单只在取得本人明确公开许可后，修改 `src/data/members.mjs`。
- 论文只根据已核实的 DOI 元数据，修改 `src/data/publications.mjs`。
- 课题组名称、导师、学校和研究方向修改 `src/data/site.mjs`。
- 校徽来源与授权说明维护在 `src/assets/SOURCES.md`。

## 公开信息规则

- 不公开导师电话或任何电话字段。
- 不上传出版社 PDF 副本；论文只提供 DOI 链接。
- 未获同意的成员不得列入网站。
- 保留两所学校官方标识的原文件、原始长宽比与相同显示高度；生产发布前再次确认学校的授权与视觉识别规范。

## 发布

先执行 `npm.cmd run build` 和 `npm.cmd run check`。生产部署通过 Codex Sites，使用已保存且通过核验的版本进行发布。
