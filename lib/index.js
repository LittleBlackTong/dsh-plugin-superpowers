/**
 * dsh-plugin-superpowers — obra/superpowers skills for DeepSeek Harness.
 *
 * Ports the 14 development-methodology skills from the
 * [obra/superpowers](https://github.com/obra/superpowers) collection into the
 * DSH skill registry (`ctx.skills.register`), so the `skill` tool can load
 * them in any session where this plugin is mounted.
 *
 * ## What it registers
 *
 * - `using-superpowers` — entry skill: check skills before any response
 * - `brainstorming` — requirements/design exploration before creative work
 * - `writing-plans` — bite-sized implementation plans with TDD tasks
 * - `executing-plans` — plan execution with review checkpoints
 * - `subagent-driven-development` — fresh subagent per task + two-stage review
 * - `test-driven-development` — RED-GREEN-REFACTOR discipline
 * - `systematic-debugging` — evidence-first debugging workflow
 * - `dispatching-parallel-agents` — parallel independent agent dispatch
 * - `using-git-worktrees` — isolated worktree per feature
 * - `finishing-a-development-branch` — integration decision flow
 * - `requesting-code-review` / `receiving-code-review` — review loop
 * - `verification-before-completion` — evidence before success claims
 * - `writing-skills` — meta-skill: authoring new skills
 *
 * Each skill keeps its original auxiliary files (prompts, scripts,
 * references) in `skills/<name>/`, and `resourceBase` points at that
 * directory so relative references inside the instruction body resolve.
 *
 * ## Config
 *
 * | key | default | meaning |
 * |---|---|---|
 * | `enabled` | `true` | master switch for all registrations |
 * | `enabledSkills` | all | optional allowlist of skill names to register |
 *
 * ## Install
 *
 * ```sh
 * pnpm add dsh-plugin-superpowers
 * ```
 *
 * Add to the profile `package.json` `dsh.profile.bundles` array. The bundle
 * patch (declared via `dsh.bundle.patch`) inserts the plugin row; no manual
 * `cordis.patch.yml` edit is needed.
 *
 * @module dsh-plugin-superpowers
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import z from '@deepseek-ai/schemastery'

export const name = 'superpowers'

export const inject = ['skills']

/** Schemastery schema applied to the plugin config before startup. */
export const Config = z.object({
  enabled: z.boolean().default(true),
  enabledSkills: z.union([z.array(z.string()), z.const(undefined)]),
})

const here = dirname(fileURLToPath(import.meta.url))
const SKILL_ROOT = join(here, '..', 'skills')
const MANIFEST_PATH = join(SKILL_ROOT, 'manifest.json')

/**
 * Read the package manifest `{ <skill-name>: { description } }`.
 * @returns {Record<string, { description: string }>}
 */
function readManifest() {
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
  } catch {
    return {}
  }
}

/**
 * Read one skill's instruction body from `skills/<name>/SKILL.md`.
 * @param {string} skillName
 * @returns {string}
 */
function skillContent(skillName) {
  try {
    return readFileSync(join(SKILL_ROOT, skillName, 'SKILL.md'), 'utf8')
  } catch {
    return ''
  }
}

/**
 * Cordis plugin entry.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {{ enabled?: boolean; enabledSkills?: string[] }} config
 * @returns {() => void} disposer
 */
export function apply(ctx, config = {}) {
  const skills = ctx.get('skills')
  if (skills === undefined) return
  if (config.enabled === false) return

  const manifest = readManifest()
  const allowed = Array.isArray(config.enabledSkills)
    ? new Set(config.enabledSkills)
    : null

  const disposers = []
  for (const skillName of Object.keys(manifest)) {
    if (allowed !== null && !allowed.has(skillName)) continue
    const meta = manifest[skillName]
    const content = skillContent(skillName)
    if (content.length === 0) {
      ctx.logger?.warn(`dsh-plugin-superpowers: empty body for ${skillName}, skipped`)
      continue
    }
    disposers.push(skills.register({
      name: skillName,
      description: meta.description,
      content,
      source: 'dsh-plugin-superpowers',
      resourceBase: { kind: 'directory', path: join(SKILL_ROOT, skillName) },
    }))
  }

  ctx.logger?.info(`dsh-plugin-superpowers: registered ${disposers.length} skills`)

  // Slash command: `/superpowers` lists the skills; `/superpowers <name> <task>`
  // injects a followup that asks the agent to run that skill (same pattern as
  // zdp-data-export's `/zdp` command).
  let commandDisposer
  const commands = ctx.get('commands')
  if (commands !== undefined && typeof commands.register === 'function') {
    commandDisposer = commands.register({
      name: 'superpowers',
      description: 'Superpowers 技能：/superpowers 列出全部技能；/superpowers <技能名> <任务描述> 触发指定技能',
      async handler({ agent, rawInput }) {
        try {
          const input = String(rawInput || '').trim()
          const match = /^([a-z0-9-]+)\s*([\s\S]*)$/.exec(input)
          const skillName = match ? match[1] : ''
          const rest = match ? match[2].trim() : ''
          const known = manifest[skillName] !== undefined

          if (skillName && known) {
            if (agent && typeof agent.followup === 'function') {
              const message = {
                id: 'superpowers-cmd-' + Date.now() + '-' + Math.floor(Math.random() * 1e6),
                role: 'user',
                content: [{
                  type: 'text',
                  text: `【superpowers 技能：${skillName}】${rest || '请先调用 skill 工具加载该技能，再严格按技能流程处理当前任务。'}`,
                }],
                // Session format v4 admits only a producer-owned kind; the
                // retired {kind:'plugin', plugin:...} wrapper is rejected.
                source: { kind: 'plugin:dsh-plugin-superpowers' },
              }
              await agent.followup(message)
              return { kind: 'success', text: `已触发技能 ${skillName}，请看对话进展。` }
            }
            return { kind: 'error', text: '当前 agent 不支持注入任务' }
          }

          // No arg or unknown skill: show the catalog.
          const lines = Object.keys(manifest).map((n) => `- \`${n}\``)
          const hint = skillName && !known
            ? `未知技能 "${skillName}"。`
            : ''
          return {
            kind: 'success',
            text: `${hint}可用技能（14 个）：\n${lines.join('\n')}\n用法：/superpowers <技能名> <任务描述>，如 /superpowers brainstorming 我要做个新功能`,
          }
        } catch (error) {
          return { kind: 'error', text: 'superpowers 命令失败: ' + String(error && error.message || error) }
        }
      },
    })
  }

  return () => {
    for (const disposer of disposers) disposer()
    if (commandDisposer !== undefined) commandDisposer()
  }
}

// DSH's loader unwraps a package's default export before it starts the
// Cordis plugin. Keep the default export callable for direct consumers, but
// attach the Cordis metadata to that function so injected services and the
// config schema survive the unwrap step.
Object.defineProperties(apply, {
  name: { value: name },
  inject: { value: inject },
  Config: { value: Config },
})

export default apply
