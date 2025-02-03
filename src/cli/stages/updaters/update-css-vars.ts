import type Root from 'postcss/lib/root'
import type Rule from 'postcss/lib/rule'

import type { Config, RegistryItemCssVarsSchema, RegistryItemTailwindSchema } from '../../../registry'
import type { TailwindVersion } from '../get-project-info'

import fs from 'node:fs/promises'
import path from 'node:path'
import * as p from '@clack/prompts'
import c from 'picocolors'
import postcss from 'postcss'
import AtRule from 'postcss/lib/at-rule'
import * as v from 'valibot'

export async function updateCssVars(
  cssVars: v.InferOutput<typeof RegistryItemCssVarsSchema> | undefined,
  config: Config,
  options: {
    tailwindVersion?: TailwindVersion
    tailwindConfig?: v.InferOutput<typeof RegistryItemTailwindSchema>['config']
  },
): Promise<void> {
  if (!config.resolvedPaths.tailwindCss) {
    return
  }

  options = {
    tailwindVersion: 'v3',
    ...options,
  }
  const cssFilepath = config.resolvedPaths.tailwindCss
  const cssFilepathRelative = path.relative(
    config.resolvedPaths.cwd,
    cssFilepath,
  )
  const cssVarsSpinner = p.spinner()
  cssVarsSpinner.start(`Updating ${c.blue(cssFilepathRelative)}`)

  const raw = await fs.readFile(cssFilepath, 'utf8')
  const output = await transformCssVars(raw, cssVars ?? {}, config, {
    tailwindVersion: options.tailwindVersion,
    tailwindConfig: options.tailwindConfig,
  })
  await fs.writeFile(cssFilepath, output, 'utf8')
  cssVarsSpinner.stop(`Updated ${c.blue(cssFilepathRelative)}`)
}

export async function transformCssVars(
  input: string,
  cssVars: v.InferOutput<typeof RegistryItemCssVarsSchema>,
  config: Config,
  options: {
    tailwindVersion?: TailwindVersion
    tailwindConfig?: v.InferOutput<typeof RegistryItemTailwindSchema>['config']
  } = {
    tailwindVersion: 'v3',
    tailwindConfig: undefined,
  },
): Promise<string> {
  options = {
    tailwindVersion: 'v3',
    tailwindConfig: undefined,
    ...options,
  }

  let plugins = [updateCssVarsPlugin(cssVars)]

  if (options.tailwindVersion === 'v4') {
    plugins = [addCustomVariant({ params: 'dark (&:is(.dark *))' })]

    plugins.push(updateCssVarsPluginV4(cssVars))
    plugins.push(updateThemePlugin(cssVars))

    if (options.tailwindConfig) {
      plugins.push(updateTailwindConfigPlugin(options.tailwindConfig))
      plugins.push(updateTailwindConfigAnimationPlugin(options.tailwindConfig))
      plugins.push(updateTailwindConfigKeyframesPlugin(options.tailwindConfig))
    }
  }

  if (config.tailwind.cssVariables) {
    plugins.push(updateBaseLayerPlugin())
  }

  const result = await postcss(plugins).process(input, {
    from: undefined,
  })

  let output = result.css.replace(/\/\* ---break--- \*\//g, '')

  if (options.tailwindVersion === 'v4') {
    output = output.replace(/(\n\s*\n)+/g, '\n\n')
  }

  return output
}

function updateCssVarsPlugin(
  cssVars: v.InferOutput<typeof RegistryItemCssVarsSchema>,
): { postcssPlugin: string, Once: (root: Root) => void } {
  return {
    postcssPlugin: 'update-css-vars',
    Once(root: Root) {
      let baseLayer = root.nodes.find(
        node =>
          node.type === 'atrule'
          && node.name === 'layer'
          && node.params === 'base',
      ) as AtRule | undefined

      if (!(baseLayer instanceof AtRule)) {
        baseLayer = postcss.atRule({
          name: 'layer',
          params: 'base',
          nodes: [],
          raws: {
            semicolon: true,
            before: '\n',
            between: ' ',
          },
        })
        root.append(baseLayer)
        root.insertBefore(baseLayer, postcss.comment({ text: '---break---' }))
      }

      if (baseLayer !== undefined) {
        // Add variables for each key in cssVars
        Object.entries(cssVars).forEach(([key, vars]) => {
          const selector = key === 'light' ? ':root' : `.${key}`
          // TODO: Fix typecheck.
          addOrUpdateVars(baseLayer as AtRule, selector, vars)
        })
      }
    },
  }
}

function addOrUpdateVars(
  baseLayer: AtRule,
  selector: string,
  vars: Record<string, string>,
): void {
  let ruleNode = baseLayer.nodes?.find(
    (node): node is Rule => node.type === 'rule' && node.selector === selector,
  )

  if (!ruleNode) {
    if (Object.keys(vars).length > 0) {
      ruleNode = postcss.rule({
        selector,
        raws: { between: ' ', before: '\n  ' },
      })
      baseLayer.append(ruleNode)
    }
  }

  Object.entries(vars).forEach(([key, value]) => {
    const prop = `--${key.replace(/^--/, '')}`
    const newDecl = postcss.decl({
      prop,
      value,
      raws: { semicolon: true },
    })

    const existingDecl = ruleNode?.nodes.find(
      (node): node is postcss.Declaration =>
        node.type === 'decl' && node.prop === prop,
    )

    existingDecl ? existingDecl.replaceWith(newDecl) : ruleNode?.append(newDecl)
  })
}

function addCustomVariant({ params }: { params: string }): { postcssPlugin: string, Once: (root: Root) => void } {
  return {
    postcssPlugin: 'add-custom-variant',
    Once(root: Root) {
      const customVariant = root.nodes.find(
        (node): node is AtRule =>
          node.type === 'atrule' && node.name === 'custom-variant',
      )
      if (!customVariant) {
        const variantNode = postcss.atRule({
          name: 'custom-variant',
          params,
          raws: { semicolon: true, before: '\n' },
        })
        root.insertAfter(root.nodes[0], variantNode)
        root.insertBefore(variantNode, postcss.comment({ text: '---break---' }))
      }
    },
  }
}

function updateCssVarsPluginV4(
  cssVars: v.InferOutput<typeof RegistryItemCssVarsSchema>,
): { postcssPlugin: string, Once: (root: Root) => void } {
  return {
    postcssPlugin: 'update-css-vars-v4',
    Once(root: Root) {
      Object.entries(cssVars).forEach(([key, vars]) => {
        const selector = key === 'light' ? ':root' : `.${key}`

        let ruleNode = root.nodes?.find(
          (node): node is Rule =>
            node.type === 'rule' && node.selector === selector,
        )

        if (!ruleNode) {
          ruleNode = postcss.rule({
            selector,
            nodes: [],
            raws: { semicolon: true, between: ' ', before: '\n' },
          })
          root.append(ruleNode)
          root.insertBefore(ruleNode, postcss.comment({ text: '---break---' }))
        }

        Object.entries(vars).forEach(([key, value]) => {
          let prop = `--${key.replace(/^--/, '')}`

          // Special case for sidebar-background.
          if (prop === '--sidebar-background') {
            prop = '--sidebar'
          }

          if (isLocalHSLValue(value)) {
            value = `hsl(${value})`
          }

          const newDecl = postcss.decl({
            prop,
            value,
            raws: { semicolon: true },
          })
          const existingDecl = ruleNode?.nodes.find(
            (node): node is postcss.Declaration =>
              node.type === 'decl' && node.prop === prop,
          )
          existingDecl
            ? existingDecl.replaceWith(newDecl)
            : ruleNode?.append(newDecl)
        })
      })
    },
  }
}

export function isLocalHSLValue(value: string): boolean {
  if (
    value.startsWith('hsl')
    || value.startsWith('rgb')
    || value.startsWith('#')
    || value.startsWith('oklch')
  ) {
    return false
  }

  const chunks = value.split(' ')

  return (
    chunks.length === 3
    && chunks.slice(1, 3).every(chunk => chunk.includes('%'))
  )
}

function updateThemePlugin(cssVars: v.InferOutput<typeof RegistryItemCssVarsSchema>): { postcssPlugin: string, Once: (root: Root) => void } {
  return {
    postcssPlugin: 'update-theme',
    Once(root: Root) {
      // Find unique color names from light and dark.
      const variables = Array.from(
        new Set(
          Object.keys(cssVars).flatMap(key =>
            Object.keys(cssVars[key as keyof typeof cssVars] || {}),
          ),
        ),
      )

      if (!variables.length) {
        return
      }

      const themeNode = upsertThemeNode(root)

      const themeVarNodes = themeNode.nodes?.filter(
        (node): node is postcss.Declaration =>
          node.type === 'decl' && node.prop.startsWith('--'),
      )

      for (const variable of variables) {
        const value = Object.values(cssVars).find(vars => vars[variable])?.[
          variable
        ]

        if (!value) {
          continue
        }

        if (variable === 'radius') {
          const radiusVariables = {
            sm: 'calc(var(--radius) - 4px)',
            md: 'calc(var(--radius) - 2px)',
            lg: 'var(--radius)',
            xl: 'calc(var(--radius) + 4px)',
          }
          for (const [key, value] of Object.entries(radiusVariables)) {
            const cssVarNode = postcss.decl({
              prop: `--radius-${key}`,
              value,
              raws: { semicolon: true },
            })
            if (
              themeNode?.nodes?.find(
                (node): node is postcss.Declaration =>
                  node.type === 'decl' && node.prop === cssVarNode.prop,
              )
            ) {
              continue
            }
            themeNode?.append(cssVarNode)
          }
          break
        }

        let prop
          = isLocalHSLValue(value) || isColorValue(value)
            ? `--color-${variable.replace(/^--/, '')}`
            : `--${variable.replace(/^--/, '')}`
        if (prop === '--color-sidebar-background') {
          prop = '--color-sidebar'
        }

        let propValue = `var(--${variable})`
        if (prop === '--color-sidebar') {
          propValue = 'var(--sidebar)'
        }

        const cssVarNode = postcss.decl({
          prop,
          value: propValue,
          raws: { semicolon: true },
        })
        const existingDecl = themeNode?.nodes?.find(
          (node): node is postcss.Declaration =>
            node.type === 'decl' && node.prop === cssVarNode.prop,
        )
        if (!existingDecl) {
          if (themeVarNodes?.length) {
            themeNode?.insertAfter(
              themeVarNodes[themeVarNodes.length - 1],
              cssVarNode,
            )
          }
          else {
            themeNode?.append(cssVarNode)
          }
        }
      }
    },
  }
}

function upsertThemeNode(root: Root): AtRule {
  let themeNode = root.nodes.find(
    (node): node is AtRule =>
      node.type === 'atrule'
      && node.name === 'theme'
      && node.params === 'inline',
  )

  if (!themeNode) {
    themeNode = postcss.atRule({
      name: 'theme',
      params: 'inline',
      nodes: [],
      raws: { semicolon: true, between: ' ', before: '\n' },
    })
    root.append(themeNode)
    root.insertBefore(themeNode, postcss.comment({ text: '---break---' }))
  }

  return themeNode
}

export function isColorValue(value: string): boolean {
  return (
    value.startsWith('hsl')
    || value.startsWith('rgb')
    || value.startsWith('#')
    || value.startsWith('oklch')
  )
}

function updateTailwindConfigPlugin(tailwindConfig: v.InferOutput<typeof RegistryItemTailwindSchema>['config']): { postcssPlugin: string, Once: (root: Root) => void } {
  return {
    postcssPlugin: 'update-tailwind-config',
    Once(root: Root) {
      if (!tailwindConfig?.plugins) {
        return
      }

      const quoteType = getQuoteType(root)
      const quote = quoteType === 'single' ? '\'' : '"'

      const pluginNodes = root.nodes.filter(
        (node): node is AtRule =>
          node.type === 'atrule' && node.name === 'plugin',
      )

      const lastPluginNode
        = pluginNodes[pluginNodes.length - 1] || root.nodes[0]

      for (const plugin of tailwindConfig.plugins) {
        const pluginName = plugin.replace(/^require\(["']|["']\)$/g, '')

        // Check if the plugin is already present.
        if (
          pluginNodes.some((node) => {
            return node.params.replace(/["']/g, '') === pluginName
          })
        ) {
          continue
        }

        const pluginNode = postcss.atRule({
          name: 'plugin',
          params: `${quote}${pluginName}${quote}`,
          raws: { semicolon: true, before: '\n' },
        })
        root.insertAfter(lastPluginNode, pluginNode)
        root.insertBefore(pluginNode, postcss.comment({ text: '---break---' }))
      }
    },
  }
}

function getQuoteType(root: Root): 'single' | 'double' {
  const firstNode = root.nodes[0]
  const raw = firstNode.toString()

  if (raw.includes('\'')) {
    return 'single'
  }
  return 'double'
}

function updateTailwindConfigAnimationPlugin(
  tailwindConfig: v.InferOutput<typeof RegistryItemTailwindSchema>['config'],
): { postcssPlugin: string, Once: (root: Root) => void } {
  return {
    postcssPlugin: 'update-tailwind-config-animation',
    Once(root: Root) {
      if (!tailwindConfig?.theme?.extend?.animation) {
        return
      }

      const themeNode = upsertThemeNode(root)
      const existingAnimationNodes = themeNode.nodes?.filter(
        (node): node is postcss.Declaration =>
          node.type === 'decl' && node.prop.startsWith('--animate-'),
      )

      const parsedAnimationValue = v.safeParse(v
        .record(v.string(), v.string()), tailwindConfig.theme.extend.animation)
      if (!parsedAnimationValue.success) {
        return
      }

      for (const [key, value] of Object.entries(parsedAnimationValue.output)) {
        const prop = `--animate-${key}`
        if (
          existingAnimationNodes?.find(
            (node): node is postcss.Declaration => node.prop === prop,
          )
        ) {
          continue
        }

        const animationNode = postcss.decl({
          prop,
          value,
          raws: { semicolon: true, between: ': ', before: '\n  ' },
        })
        themeNode.append(animationNode)
      }
    },
  }
}

function updateTailwindConfigKeyframesPlugin(
  tailwindConfig: v.InferOutput<typeof RegistryItemTailwindSchema>['config'],
): { postcssPlugin: string, Once: (root: Root) => void } {
  return {
    postcssPlugin: 'update-tailwind-config-keyframes',
    Once(root: Root) {
      if (!tailwindConfig?.theme?.extend?.keyframes) {
        return
      }

      const themeNode = upsertThemeNode(root)
      const existingKeyFrameNodes = themeNode.nodes?.filter(
        (node): node is AtRule =>
          node.type === 'atrule' && node.name === 'keyframes',
      )

      const keyframeValueSchema = v.record(
        v.string(),
        v.record(v.string(), v.string()),
      )

      for (const [keyframeName, keyframeValue] of Object.entries(
        tailwindConfig.theme.extend.keyframes,
      )) {
        if (typeof keyframeName !== 'string') {
          continue
        }

        const parsedKeyframeValue = v.safeParse(keyframeValueSchema, keyframeValue)

        if (!parsedKeyframeValue.success) {
          continue
        }

        if (
          existingKeyFrameNodes?.find(
            (node): node is postcss.AtRule =>
              node.type === 'atrule'
              && node.name === 'keyframes'
              && node.params === keyframeName,
          )
        ) {
          continue
        }

        const keyframeNode = postcss.atRule({
          name: 'keyframes',
          params: keyframeName,
          nodes: [],
          raws: { semicolon: true, between: ' ', before: '\n  ' },
        })

        for (const [key, values] of Object.entries(parsedKeyframeValue.output)) {
          const rule = postcss.rule({
            selector: key,
            nodes: Object.entries(values).map(([key, value]) =>
              postcss.decl({
                prop: key,
                value,
                raws: { semicolon: true, before: '\n      ', between: ': ' },
              }),
            ),
            raws: { semicolon: true, between: ' ', before: '\n    ' },
          })
          keyframeNode.append(rule)
        }

        themeNode.append(keyframeNode)
        themeNode.insertBefore(
          keyframeNode,
          postcss.comment({ text: '---break---' }),
        )
      }
    },
  }
}

function updateBaseLayerPlugin(): { postcssPlugin: string, Once: (root: Root) => void } {
  return {
    postcssPlugin: 'update-base-layer',
    Once(root: Root) {
      const requiredRules = [
        { selector: '*', apply: 'border-border' },
        { selector: 'body', apply: 'bg-background text-foreground' },
      ]

      let baseLayer = root.nodes.find(
        (node): node is AtRule =>
          node.type === 'atrule'
          && node.name === 'layer'
          && node.params === 'base'
          && requiredRules.every(({ selector, apply }) =>
            node.nodes?.some(
              (rule): rule is Rule =>
                rule.type === 'rule'
                && rule.selector === selector
                && rule.nodes.some(
                  (applyRule): applyRule is AtRule =>
                    applyRule.type === 'atrule'
                    && applyRule.name === 'apply'
                    && applyRule.params === apply,
                ),
            ),
          ),
      ) as AtRule | undefined

      if (!baseLayer) {
        baseLayer = postcss.atRule({
          name: 'layer',
          params: 'base',
          raws: { semicolon: true, between: ' ', before: '\n' },
        })
        root.append(baseLayer)
        root.insertBefore(baseLayer, postcss.comment({ text: '---break---' }))
      }

      requiredRules.forEach(({ selector, apply }) => {
        const existingRule = baseLayer?.nodes?.find(
          (node): node is Rule =>
            node.type === 'rule' && node.selector === selector,
        )

        if (!existingRule) {
          baseLayer?.append(
            postcss.rule({
              selector,
              nodes: [
                postcss.atRule({
                  name: 'apply',
                  params: apply,
                  raws: { semicolon: true, before: '\n    ' },
                }),
              ],
              raws: { semicolon: true, between: ' ', before: '\n  ' },
            }),
          )
        }
      })
    },
  }
}
