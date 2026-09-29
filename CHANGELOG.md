# Changelog

所有记录跟随 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 风格；版本号与 `package.json` 保持一致。

> 本文件自 0.1.1 起记录（0.1.0 为初始技能移植版本，无历史条目）。

## [0.1.2] - 2026-09-29

### Fixed（DSH 0.2.0 兼容）

- **声明支持 DSH 0.2.x 运行时**：`peerDependencies` 中 `@deepseek-ai/dsh-skill` 的范围由 `^0.1.0-rc.6` 扩为 **`^0.1.0-rc.6 || ^0.2.0-rc.1`**。
  - **症状**：DSH 运行时升级到 `0.2.0-rc.1` 后，插件被兼容性闸门判定为 incompatible，启动时**整个 bundle 被静默跳过**，14 个方法论技能与 `/superpowers` 命令全部不可用。
  - **原因**：DSH 的 `evaluatePluginCompatibility` **只按 `peerDependencies` 里的 `@deepseek-ai/dsh-*` 范围**与运行版本做 semver 匹配（`includePrerelease`），旧范围不含 `0.2.x`，于是被拒。
  - **说明**：本插件实际使用的 `ctx.skills.register()` 与 `ctx.commands.register()` 在 0.2.0 中**签名未变**，属声明过时而非接口破裂；沿用旧范围可继续兼容 `0.1.x` 运行时。

## [0.1.1] - 2026-09-28

### Fixed（DSH session format v4 兼容）

- **修复斜杠命令注入消息被 v4 拒绝**：`/superpowers <技能>` 触发时投递给 `agent.followup()` 的 message source 从 `{ kind: 'plugin', plugin: 'dsh-plugin-superpowers' }` 改为 **`{ kind: 'plugin:dsh-plugin-superpowers' }`**。
  - **症状**：执行 `/superpowers writing-plans` 之类的命令时抛 `SessionFormatError: format v4 message requires a producer-owned source kind`；它被 `dsh-agent-loop` 当作非 LLM 错误包成 `{ message, code: 'UNKNOWN' }`，界面上显示为 `... source kind UNKNOWN`——**`UNKNOWN` 是错误码，不是 kind 值**。
  - **原因**：session format **v4**（官方 DeepSeek Harness **0.1.7+**）的原生准入 `source()` 明确拒绝 `kind === "plugin"` 这一 v3 时代的 wrapper，要求 producer-owned kind；第三方插件的形态是 `plugin:<name>`。
  - **兼容性门槛**：v4 校验与 v3 的 `SOURCE_KINDS` 白名单**互斥**（v3 只认 `plugin`），**无法同时兼容两版**。**本版起要求 DSH session format v4（官方 0.1.7+）**；旧版 DSH 请停留在 0.1.0。
  - **历史 session 不受影响**：v3→v4 迁移会自动转换旧 wrapper，只有**新注入**的消息需要改。

### Tests

- `test/skill.test.mjs` 的 source 断言改为 `deepEqual(source, { kind: 'plugin:dsh-plugin-superpowers' })`。
- 先写测试并确认其失败（`actual: {kind:'plugin',plugin:'dsh-plugin-superpowers'}` vs `expected: {kind:'plugin:dsh-plugin-superpowers'}`）后才改实现。
- 单测 **11/11 通过**。
