import { Workflow } from 'lucide-react'
import styles from './academy.module.css'

export function CourseCover() {
  return (
    <div
      className={styles.cover}
      role="img"
      aria-label="Problem verstehen, System bauen und Wirkung erzielen"
    >
      <div className={styles.coverStack} aria-hidden="true">
        <div className={styles.coverCard}>
          <span>01</span>
          <div>
            <small>ENTREPRENEURSHIP</small>
            <strong>Problem verstehen</strong>
          </div>
        </div>
        <div className={styles.coverCard}>
          <Workflow />
          <div>
            <small>SOFTWARE & AI</small>
            <strong>System bauen</strong>
          </div>
        </div>
        <div className={styles.coverCard}>
          <span>03</span>
          <div>
            <small>BUSINESS IMPACT</small>
            <strong>Wirkung erzielen</strong>
          </div>
        </div>
      </div>
    </div>
  )
}
