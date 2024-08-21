import dynamic from 'next/dynamic'
import style from './style.module.css'
import Table from '../../Table'
import { Alert } from '@mui/material'

const Map = dynamic(() => import('../../Map'), { ssr: false })

export default function HomePage() {
  return (
    <div className={style.root}>
      <Map />
      <Alert severity="warning">Please note the dashboard is currently under review and eligibility indicator might change</Alert>
      <Table />
    </div>
  )
}
