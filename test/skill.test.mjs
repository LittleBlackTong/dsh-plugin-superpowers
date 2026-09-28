/**
 * Plugin self-test: drive apply() with a mock ctx and assert the 14 skills
 * register correctly. Mirrors how dsh-plugin-memory tests its skill path —
 * no live DSH process needed.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { apply } from '../lib/index.js'

const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function mockCtx() {
  const registered = []
  const commands = []
  const logs = []
  const ctx = {
    get(name) {
      if (name === 'skills') {
        return {
          register(skill) {
            // Mirror @deepseek-ai/dsh-skill registry defaults.
            registered.push({
              ...skill,
              invocation: skill.invocation ?? {
                modelInvocable: true,
                userInvocable: true,
              },
              provider: skill.provider ?? 'runtime',
            })
            let disposed = false
            return () => {
              disposed = true
            }
          },
        }
      }
      if (name === 'commands') {
        return {
          register(definition) {
            commands.push(definition)
            let disposed = false
            return () => {
              disposed = true
            }
          },
        }
      }
      return undefined
    },
    logger: {
      info: (...args) => logs.push(['info', ...args]),
      warn: (...args) => logs.push(['warn', ...args]),
    },
  }
  return { ctx, registered, commands, logs }
}

test('apply registers exactly 14 skills', () => {
  const { ctx, registered } = mockCtx()
  const disposer = apply(ctx, {})
  assert.equal(registered.length, 14)
  assert.equal(typeof disposer, 'function')
})

test('every skill has valid name, non-empty description and content', () => {
  const { ctx, registered } = mockCtx()
  apply(ctx, {})
  for (const skill of registered) {
    assert.match(skill.name, SKILL_NAME, `invalid name: ${skill.name}`)
    assert.ok(skill.description.length > 0, `empty description: ${skill.name}`)
    assert.ok(skill.content.length > 0, `empty content: ${skill.name}`)
    assert.equal(skill.source, 'dsh-plugin-superpowers')
    assert.equal(skill.provider, 'runtime')
    assert.equal(skill.invocation.modelInvocable, true)
    assert.equal(skill.invocation.userInvocable, true)
    assert.equal(skill.resourceBase.kind, 'directory')
  }
})

test('content contains no leftover superpowers: prefix', () => {
  const { ctx, registered } = mockCtx()
  apply(ctx, {})
  for (const skill of registered) {
    assert.ok(
      !skill.content.includes('superpowers:'),
      `leftover prefix in ${skill.name}`,
    )
  }
})

test('enabled: false registers nothing', () => {
  const { ctx, registered } = mockCtx()
  const disposer = apply(ctx, { enabled: false })
  assert.equal(registered.length, 0)
  assert.equal(disposer, undefined)
})

test('enabledSkills allowlist restricts registration', () => {
  const { ctx, registered } = mockCtx()
  apply(ctx, { enabledSkills: ['brainstorming', 'writing-plans'] })
  const names = registered.map((s) => s.name).sort()
  assert.deepEqual(names, ['brainstorming', 'writing-plans'])
})

test('disposer runs without throwing', () => {
  const { ctx, registered } = mockCtx()
  const disposer = apply(ctx, {})
  assert.doesNotThrow(() => disposer())
  // idempotent
  assert.doesNotThrow(() => disposer())
})

test('resourceBase points to an existing skills/<name> directory', () => {
  const { ctx, registered } = mockCtx()
  apply(ctx, {})
  for (const skill of registered) {
    assert.ok(
      skill.resourceBase.path.endsWith(`/skills/${skill.name}`),
      `bad resourceBase for ${skill.name}: ${skill.resourceBase.path}`,
    )
  }
})

test('registers the /superpowers slash command', () => {
  const { ctx, commands } = mockCtx()
  apply(ctx, {})
  assert.equal(commands.length, 1)
  assert.equal(commands[0].name, 'superpowers')
  assert.equal(typeof commands[0].handler, 'function')
})

test('slash command lists skills when invoked without a skill name', async () => {
  const { ctx, commands } = mockCtx()
  apply(ctx, {})
  const result = await commands[0].handler({ agent: undefined, rawInput: '' })
  assert.equal(result.kind, 'success')
  assert.match(result.text, /brainstorming/)
  assert.match(result.text, /writing-plans/)
  assert.match(result.text, /\/superpowers/)
})

test('slash command injects a followup for a known skill', async () => {
  const { ctx, commands } = mockCtx()
  apply(ctx, {})
  const followups = []
  const agent = {
    followup: async (message) => {
      followups.push(message)
    },
  }
  const result = await commands[0].handler({ agent, rawInput: 'brainstorming 我要做个新功能' })
  assert.equal(result.kind, 'success')
  assert.equal(followups.length, 1)
  assert.match(followups[0].content[0].text, /superpowers 技能：brainstorming/)
  assert.match(followups[0].content[0].text, /我要做个新功能/)
  // Session format v4 admits only a producer-owned kind.
  assert.deepEqual(followups[0].source, { kind: 'plugin:dsh-plugin-superpowers' })
})

test('slash command rejects unknown skills with the catalog', async () => {
  const { ctx, commands } = mockCtx()
  apply(ctx, {})
  const result = await commands[0].handler({ agent: undefined, rawInput: 'nosuchskill 任务' })
  assert.equal(result.kind, 'success')
  assert.match(result.text, /未知技能/)
  assert.match(result.text, /brainstorming/)
})
