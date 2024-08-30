import dynamic from 'next/dynamic'
import style from './style.module.css'
import Table from '../../Table'
import { Alert, Link } from '@mui/material'

const Map = dynamic(() => import('../../Map'), { ssr: false })

export default function HomePage() {
  return (
    <div className={style.root}>
      <Map />
      <Alert severity="warning">
        Please note the dashboard is currently under review and the eligibility indicator might change. For more details, please check out the following blog post:  
        <Link href="https://blog.oceanprotocol.com/ocean-nodes-incentives-a-detailed-breakdown-0baf8fc98001" target="_blank" rel="noopener">
          Ocean Nodes Incentives: A Detailed Breakdown
        </Link>.
      </Alert>
      <Table />
    </div>
  )
}
