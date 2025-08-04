import { visit } from 'unist-util-visit'
import type { Plugin } from 'unified'
import type { Root, Element } from 'hast'

/**
 * A rehype plugin to remove <p> tags that are direct children of <li> tags,
 * lifting their content up to the <li> level while preserving proper text layout.
 * This fixes the common markdown parsing issue where list items contain unnecessary <p> wrapping.
 */
export const rehypeRemovePTagsInLi: Plugin<[], Root> = () => (tree) => {
  visit(tree, 'element', (node) => {
    if (node.tagName === 'li') {
      const newChildren: Element['children'] = []
      let modified = false

      node.children.forEach(child => {
        if (child.type === 'element' && child.tagName === 'p') {
          // Check if this is the only paragraph in the list item
          const paragraphCount = node.children.filter(
            c => c.type === 'element' && c.tagName === 'p'
          ).length
          
          if (paragraphCount === 1) {
            // If it's the only paragraph, lift its children up
            newChildren.push(...child.children)
            modified = true
          } else {
            // If there are multiple paragraphs, wrap content in a span
            newChildren.push({
              type: 'element',
              tagName: 'span',
              properties: { className: ['li-content'] },
              children: child.children
            })
            modified = true
          }
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
