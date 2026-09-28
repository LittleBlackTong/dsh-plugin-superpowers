# dsh-plugin-superpowers

把 [obra/superpowers](https://github.com/obra/superpowers) 的 14 个开发方法论技能移植进 DeepSeek Harness：插件挂载后，这些技能注册到 DSH skill registry，`skill` 工具即可加载，任何会话都能调用。

## 技能清单

| 技能 | 用途 |
|---|---|
| `using-superpowers` | 入口：任何响应（含澄清问题）之前先检查是否适用技能 |
| `brainstorming` | 创造性工作前：探索需求、约束与设计，产出 spec |
| `writing-plans` | 把 spec 拆成 bite-size 任务、带 TDD 循环的实现计划 |
| `executing-plans` | 计划执行：按 checkpoint 批量推进、留痕 |
| `subagent-driven-development` | 每任务一个全新 subagent + 两阶段评审（推荐执行方式） |
| `test-driven-development` | RED-GREEN-REFACTOR 纪律 |
| `systematic-debugging` | 证据优先的系统化调试工作流 |
| `dispatching-parallel-agents` | 无共享状态的独立任务并行派发 |
| `using-git-worktrees` | 每特性一个隔离 worktree |
| `finishing-a-development-branch` | 完成后的集成决策流程 |
| `requesting-code-review` / `receiving-code-review` | 代码评审闭环 |
| `verification-before-completion` | 声称完成前先跑验证命令、先证据后断言 |
| `writing-skills` | 元技能：如何编写并测试新技能 |

## 安装

```sh
pnpm add dsh-plugin-superpowers
```

在 profile 的 `package.json` `dsh.profile.bundles` 数组中加入 `"dsh-plugin-superpowers"`，重启 dsh 生效。插件的 `cordis.patch.yml`（通过 `dsh.bundle.patch` 声明）会自动插入插件行，无需手改 profile 的 patch 层。

## 配置

| key | 默认 | 含义 |
|---|---|---|
| `enabled` | `true` | 总开关 |
| `enabledSkills` | 全部 | 可选白名单，如 `["brainstorming", "writing-plans"]` |

## 适配说明

原仓库是 Claude Code 格式的 SKILL.md（YAML frontmatter 的 `name`/`description` 与 DSH 兼容）。转换只做了两处必要适配：

1. 剥离 frontmatter（`name`/`description` 收入 `skills/manifest.json`），正文作为技能内容。
2. 去掉技能交叉引用里的 `superpowers:` 前缀（如 `superpowers:writing-plans` → `writing-plans`），使引用与 DSH 技能名对齐。

辅助文件（评审 prompt、`scripts/`、`references/`）原样保留在 `skills/<name>/` 下，`resourceBase` 指向对应目录，正文里的相对引用依然有效。

### DSH 版本要求

斜杠命令注入的消息使用 producer-owned source kind `plugin:dsh-plugin-superpowers`，**要求 DSH session format v4（官方 DeepSeek Harness 0.1.7+）**。

v4 的原生准入拒绝 v3 时代的 `{kind:'plugin', plugin:...}` wrapper，报 `format v4 message requires a producer-owned source kind`；该错误被 `dsh-agent-loop` 包成 `code: "UNKNOWN"`，所以在界面上会显示成 `... source kind UNKNOWN`（**`UNKNOWN` 是错误码，不是 kind 值**）。

v4 与 v3 的白名单互斥、无法同时兼容，**0.1.0 在 v4 上会触发该错误**；旧版 DSH 请停留在 0.1.0。

## 测试

```sh
pnpm test
```

mock `ctx.skills` 驱动 `apply()`，断言 14 个技能全部注册、内容非空、元数据合法。

## License

MIT。技能内容版权归 obra/superpowers 项目（MIT）。
