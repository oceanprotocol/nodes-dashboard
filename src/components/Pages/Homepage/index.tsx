import dynamic from 'next/dynamic'
import style from './style.module.css'
import Table from '../../Table'
import { Alert } from '@mui/material'

const Map = dynamic(() => import('../../Map'), { ssr: false })

export default function HomePage() {
  return (
    <div className={style.root}>
      <Map />
      <Alert severity="warning">Please note the the reward incetives provided for running a Node are in Alpha stage and it is possible they may change.</Alert>
      <Table />
    </div>
  )
}
