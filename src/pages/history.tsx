import React from 'react'
import HistoryPage from '../components/Pages/History'
import { HistoryProvider } from '../context/HistoryContext'

const HistoryPageWrapper: React.FC = () => {
  return (
    <HistoryProvider>
      <HistoryPage />
    </HistoryProvider>
  )
}

export default HistoryPageWrapper
