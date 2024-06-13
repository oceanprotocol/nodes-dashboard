import styles from './index.module.css'
import { SupportedStorageType } from '@Types/dataTypes'

export default function SupportedStorage({
  data
}: {
  data: SupportedStorageType | undefined
}) {
  return (
    <div className={styles.indexer}>
      <div className={styles.title29}>SUPPORTED STORAGE</div>
      <div className={styles.provider}>
        <div className={styles.providerRow}>
          <div className={styles.providerTitle}>
            <b>arwave:</b>
          </div>
          <div>{data?.arwave.toString()} </div>
        </div>
        <div className={styles.providerRow}>
          <div className={styles.providerTitle}>
            <b>ipfs:</b>
          </div>
          <div>{data?.ipfs.toString()} </div>
        </div>
        <div className={styles.providerRow}>
          <div className={styles.providerTitle}>
            <b>url:</b>
          </div>
          <div>{data?.url.toString()} </div>
        </div>
      </div>
    </div>
  )
}
