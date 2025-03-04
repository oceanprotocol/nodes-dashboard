import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import { TextField, Box, InputAdornment, IconButton } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import ClearIcon from '@mui/icons-material/Clear'
import Table from '../../Table'
import { TableTypeEnum } from '../../../shared/enums/TableTypeEnum'
import styles from './index.module.css'
import HeroSection from '../../HeroSection/HeroSection'
import { useDataContext } from '../../../context/DataContext'

const HistoryPage: React.FC = () => {
  const router = useRouter()
  const { query } = router
  const [nodeAddress, setNodeAddress] = useState<string>('')
  const [isSearching, setIsSearching] = useState<boolean>(false)
  const [isInitialized, setIsInitialized] = useState<boolean>(false)
  const { setFilters } = useDataContext()

  useEffect(() => {
    if (!isInitialized && query.address && typeof query.address === 'string') {
      setNodeAddress(query.address)
      setIsSearching(true)
      setIsInitialized(true)
    }
  }, [query.address, isInitialized])

  const handleSearch = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault()

      if (nodeAddress.trim()) {
        setIsSearching(true)

        router.push(
          {
            pathname: '/history',
            query: { address: nodeAddress }
          },
          undefined,
          { shallow: true }
        )
      }
    },
    [nodeAddress, router]
  )

  const handleClear = useCallback(() => {
    setNodeAddress('')
    setIsSearching(false)

    router.push('/history', undefined, { shallow: true })

    setFilters && setFilters({})
  }, [router, setFilters])

  return (
    <div className={styles.root}>
      <HeroSection title="Search Node History" />
      <div className={styles.searchBarCenter}>
        <form onSubmit={handleSearch} className={styles.searchForm}>
          <Box sx={{ width: '600px', maxWidth: '100%' }}>
            <TextField
              fullWidth
              placeholder="Enter node address..."
              value={nodeAddress}
              onChange={(e) => setNodeAddress(e.target.value)}
              variant="outlined"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: nodeAddress && (
                  <InputAdornment position="end">
                    <IconButton onClick={handleClear} edge="end">
                      <ClearIcon />
                    </IconButton>
                  </InputAdornment>
                ),
                sx: {
                  borderRadius: '24px',
                  backgroundColor: '#fff',
                  '&.Mui-focused': {
                    boxShadow: '0 1px 6px rgba(32, 33, 36, 0.28)'
                  },
                  boxShadow: '0 1px 3px rgba(32, 33, 36, 0.28)'
                }
              }}
            />
          </Box>
        </form>
      </div>

      {isSearching && (
        <div className={styles.resultsContainer}>
          <Table
            tableType={TableTypeEnum.NODES}
            historyMode={true}
            nodeAddress={nodeAddress}
            key={`history-${nodeAddress}`}
          />
        </div>
      )}
    </div>
  )
}

export default HistoryPage
