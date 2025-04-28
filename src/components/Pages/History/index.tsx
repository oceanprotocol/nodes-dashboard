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
import PeriodSelect from '../../PeriodSelect'

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
    setIsSearching
  } = useHistoryContext()

  useEffect(() => {
    const nodeIdFromUrl = router.query.id || router.query.nodeid
    if (nodeIdFromUrl) {
      setNodeId(nodeIdFromUrl as string)
      setIsSearching(true)
    }
  }, [router.query.id, router.query.nodeid, setNodeId, setIsSearching])

  const handleSearch = () => {
    if (nodeId.trim()) {
      router.push({
        pathname: router.pathname,
        query: { id: nodeId }
      })
      setIsSearching(true)
    }
  }

  const handleClear = () => {
    setNodeId('')
    router.push({
      pathname: router.pathname
    })
  }

  const handleDateRangeChange = (newRange: any) => {
    setDateRange(newRange)
    setCurrentPage(1)
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

      {router.query.id && (
        <>
          <div className={styles.dateRangeContainer}>
            <PeriodSelect onChange={handleDateRangeChange} initialRange={dateRange} />
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
