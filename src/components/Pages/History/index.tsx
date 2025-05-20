import React, { useEffect } from 'react'
import { useRouter } from 'next/router'
import { TextField, Box, InputAdornment, IconButton } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import ClearIcon from '@mui/icons-material/Clear'
import styles from './index.module.css'
import Table from '../../Table'
import HeroSection from '../../HeroSection/HeroSection'
import { TableTypeEnum } from '../../../shared/enums/TableTypeEnum'
import { useHistoryContext } from '../../../context/HistoryContext'
import { HistoryDashboard } from '../../Dashboard'
import PeriodSelect, { DateRange } from '../../PeriodSelect'

const HistoryPage: React.FC = () => {
  const router = useRouter()
  const {
    data,
    loading,
    currentPage,
    pageSize,
    totalItems,
    nodeId,
    setNodeId,
    setCurrentPage,
    setPageSize,
    dateRange,
    setDateRange,
    setIsSearching,
    availablePeriods,
    periodsLoading
  } = useHistoryContext()

  useEffect(() => {
    const nodeIdFromUrl = router.query.id || router.query.nodeid
    if (typeof nodeIdFromUrl === 'string' && nodeIdFromUrl) {
      setNodeId(nodeIdFromUrl)
      if (!nodeId) {
        setIsSearching(true)
      }
    } else if (!nodeIdFromUrl && nodeId) {
      setNodeId('')
    }
  }, [router.query, setNodeId, nodeId])

  const handleSearch = () => {
    const trimmedNodeId = nodeId.trim()
    if (trimmedNodeId) {
      const currentQuery = { ...router.query }
      const newQuery: { [key: string]: string | string[] | undefined } = {
        ...currentQuery,
        id: trimmedNodeId
      }
      delete newQuery.nodeid

      router.push({
        pathname: router.pathname,
        query: newQuery
      })
      setIsSearching(true)
    }
  }

  const handleClear = () => {
    setNodeId('')
    const newQuery = { ...router.query }
    delete newQuery.id
    delete newQuery.nodeid
    router.push({
      pathname: router.pathname,
      query: newQuery
    })
  }

  const handleDateRangeChange = (newRange: DateRange) => {
    setDateRange(newRange)
    setCurrentPage(1)
    if (nodeId && nodeId.trim() !== '') {
      setIsSearching(true)
    }
  }

  return (
    <div className={styles.root}>
      <HeroSection title="Rewards History">
        <div className={styles.searchBarCenter}>
          <Box sx={{ width: '700px', maxWidth: '100%' }}>
            <TextField
              fullWidth
              value={nodeId}
              onChange={(e) => setNodeId(e.target.value)}
              placeholder="Enter node ID..."
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              variant="outlined"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: nodeId && (
                  <InputAdornment position="end">
                    <IconButton onClick={handleClear} edge="end">
                      <ClearIcon />
                    </IconButton>
                  </InputAdornment>
                ),
                sx: {
                  borderRadius: '20px',
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  '&.Mui-focused': {
                    boxShadow: '0 1px 6px rgba(32, 33, 36, 0.28)'
                  },
                  boxShadow: '0 1px 3px rgba(32, 33, 36, 0.28)',
                  height: '40px',
                  maxHeight: '40px'
                }
              }}
            />
          </Box>
        </div>
      </HeroSection>

      {nodeId && nodeId.trim() !== '' && (
        <>
          <div className={styles.dateRangeContainer}>
            <PeriodSelect
              onChange={handleDateRangeChange}
              initialRange={dateRange}
              availablePeriods={availablePeriods}
              periodsLoading={periodsLoading}
            />
          </div>
          <div className={styles.dashboardContainer}>
            <HistoryDashboard />
          </div>
          <Table
            tableType={TableTypeEnum.HISTORY}
            data={data}
            loading={loading}
            currentPage={currentPage}
            pageSize={pageSize}
            totalItems={totalItems}
            onPaginationChange={(page, size) => {
              setCurrentPage(page)
              setPageSize(size)
            }}
          />
        </>
      )}
    </div>
  )
}

export default HistoryPage
