# Prompt Manager Chrome Extension

轻量 Chrome Manifest V3 Prompt 管理器。

## 功能
- Prompt 新增 / 编辑 / 删除
- Websites 域名启用 / 禁用 / 删除 / 新增
- 指定网站显示悬浮圆形按钮
- 点击按钮选择 Prompt 并插入当前输入框
- Chrome Storage 本地保存
- 默认支持 chatgpt.com、claude.ai、gemini.google.com

## 安装
1. 解压 ZIP。
2. 打开 `chrome://extensions/`。
3. 开启右上角 Developer mode。
4. 点击 Load unpacked。
5. 选择解压后的 `prompt-manager-chrome` 文件夹。

## 注意
第一版使用通用 textarea/contenteditable 输入框适配器。不同 AI 网站如果后续修改 DOM，可在 `content/content.js` 的 `input()` / `insert()` 中增加站点专用适配。
