import React, { useState, useEffect, useMemo } from 'react'
import {
  Select,
  MenuItem,
  FormControl,
  Box,
  IconButton,
  Typography,
  CircularProgress
} from '@mui/material'
import 'react-day-picker/dist/style.css'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import { Dayjs } from 'dayjs'
import styles from './styles.module.css'
import { PeriodOption } from '@/services/historyService'
import { useInitializePeriodState } from './useInitializePeriodState'
import { usePeriodSelectionHandlers } from './usePeriodSelectionHandlers'

export interface DateRange {
  startDate: Dayjs | null
  endDate: Dayjs | null
}

interface PeriodSelectProps {
  onChange: (range: DateRange) => void
  initialRange?: DateRange
  availablePeriods: PeriodOption[]
  periodsLoading?: boolean
  isContextInitialising?: boolean
}

const PeriodSelect: React.FC<PeriodSelectProps> = ({
  onChange,
  initialRange,
  availablePeriods,
  periodsLoading = false,
  isContextInitialising = false
}) => {
  const { selectedPeriod, setSelectedPeriod, setDayPickerRange } =
    useInitializePeriodState(initialRange, availablePeriods, onChange)

  const { handlePeriodChange, handleReset } = usePeriodSelectionHandlers(
    availablePeriods,
    setSelectedPeriod,
    setDayPickerRange,
    onChange
  )

  const [lastSelectedPeriod, setLastSelectedPeriod] = useState<string>('')

  useEffect(() => {
    if (selectedPeriod) {
      setLastSelectedPeriod(selectedPeriod)
    }
  }, [selectedPeriod])

  const selectValue = selectedPeriod || lastSelectedPeriod

  const formatDateRangeText = useMemo(() => {
    const period = availablePeriods.find((p) => p.value === selectValue)
    if (period) {
      return `Round ${period.weekIdentifier} (${period.startDate.format('MMM D')} - ${period.endDate.format('MMM D, YYYY')})`
    }
    return 'Select Period'
  }, [selectValue, availablePeriods])

  return (
    <Box className={styles.container}>
      <FormControl variant="standard" className={styles.formControl}>
        {isContextInitialising || periodsLoading ? (
          <Box
            className={styles.select}
            sx={{ paddingLeft: '12px', paddingRight: '12px' }}
          >
            <CircularProgress size={20} sx={{ marginRight: '8px' }} />
            <Typography variant="body2" color="white">
              Loading periods...
            </Typography>
          </Box>
        ) : (
          <Select
            value={selectValue}
            onChange={handlePeriodChange}
            className={styles.select}
            IconComponent={KeyboardArrowDownIcon}
            displayEmpty
            renderValue={() => formatDateRangeText}
            MenuProps={{
              classes: { paper: styles.menuPaper }
            }}
            endAdornment={
              <IconButton
                onClick={(e) => {
                  e.stopPropagation()
                  handleReset()
                }}
                className={styles.resetButtonAdornment}
                size="small"
              >
                <RestartAltIcon sx={{ color: 'white' }} />
              </IconButton>
            }
          >
            {availablePeriods.map((period, index) => (
              <MenuItem
                key={`period-${period.value}-${index}`}
                value={period.value}
                className={styles.menuItem}
              >
                {`Round ${period.weekIdentifier} (${period.startDate.format('MMM D')} - ${period.endDate.format('MMM D, YYYY')})`}
              </MenuItem>
            ))}
          </Select>
        )}
      </FormControl>
    </Box>
  )
}

export default PeriodSelect
