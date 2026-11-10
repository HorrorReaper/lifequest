import { Fragment } from 'react'
import { ArrowRight } from 'lucide-react'
import type { LearningContentBlock } from '@/lib/learning-paths'
import styles from './academy.module.css'

export function LearningBlocks({
  blocks,
}: {
  blocks?: LearningContentBlock[]
}) {
  return blocks?.map((block, index) =>
    block.type === 'sequence' ? (
      <div
        className={styles.sequence}
        key={index}
        role="group"
        aria-label={block.items.map((item) => item.title).join(' → ')}
      >
        {block.items.map((item, i) => (
          <Fragment key={i}>
            {i > 0 && <ArrowRight aria-hidden="true" />}
            <div className={styles.sequenceItem}>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
            </div>
          </Fragment>
        ))}
      </div>
    ) : (
      <div className={styles.comparison} key={index}>
        {block.items.map((item, i) => (
          <div key={i}>
            <strong>{item.title}</strong>
            <p>{item.body}</p>
          </div>
        ))}
      </div>
    ),
  )
}
