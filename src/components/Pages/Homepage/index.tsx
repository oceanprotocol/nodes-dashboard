import dynamic from 'next/dynamic'
import style from './style.module.css'
import Table from '../../Table'

const Map = dynamic(() => import('../../Map'), { ssr: false })

export default function HomePage() {
  return (
    <div className={style.root}>
      <Map />
      <Table />
    </div>
  )
}
