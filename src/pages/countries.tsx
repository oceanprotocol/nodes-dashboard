import React from 'react'
import CountriesPage from '../components/Pages/Countries'
import { CountriesProvider } from '@/context/CountriesContext'

const CountriesPageWrapper: React.FC = () => {
  return (
    <CountriesProvider>
      <CountriesPage />
    </CountriesProvider>
  )
}

export default CountriesPageWrapper
