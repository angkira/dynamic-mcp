import { visit } from 'unist-util-visit'
import type { Plugin } from 'unified'
import type { Root, Element } from 'hast'

/**
 * A rehype plugin to remove <p> tags that are direct children of <li> tags,
 * lifting their content up to the <li> level.
 */
export const rehypeRemovePTagsInLi: Plugin<[], Root> = () => (tree) => {
  visit(tree, 'element', (node, index, parent) => {
    if (node.tagName === 'li' && parent && index !== null) {
      const newChildren: Element['children'] = []
      let modified = false

      node.children.forEach(child => {
        if (child.type === 'element' && child.tagName === 'p') {
          // If it's a <p> tag, lift its children up
          newChildren.push(...child.children)
          modified = true
        } else {
          // Otherwise, keep the child as is
          newChildren.push(child)
        }
      })

      if (modified) {
        node.children = newChildren
      }
    }
  })
}