import React, { useState, useEffect, useMemo } from 'react'
import {
  Select,
  MenuItem,
  FormControl,
  Box,
  IconButton,
  Typography,
  Popover,
  Divider,
  CircularProgress,
  Tooltip
} from '@mui/material'
import { DayPicker, DateRange as DayPickerRange } from 'react-day-picker'
import 'react-day-picker/dist/style.css'
import CloseIcon from '@mui/icons-material/Close'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import dayjs, { Dayjs } from 'dayjs'
import styles from './styles.module.css'
import { PeriodOption } from '@/services/historyService'

export interface DateRange {
  startDate: Dayjs | null
  endDate: Dayjs | null
}

interface PeriodSelectProps {
  onChange: (range: DateRange) => void
  initialRange?: DateRange
  availablePeriods: PeriodOption[]
  periodsLoading?: boolean
}

const PeriodSelect: React.FC<PeriodSelectProps> = ({
  onChange,
  initialRange,
  availablePeriods,
  periodsLoading = false
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<string>(() => {
    if (initialRange?.startDate && availablePeriods.length > 0) {
      const matchingPeriod = availablePeriods.find((p) =>
        p.startDate.isSame(initialRange.startDate, 'day')
      )
      if (matchingPeriod) {
        return matchingPeriod.value
      }
    }
    return availablePeriods.length > 0 ? availablePeriods[0].value : ''
  })

  const [lastSelectedPeriod, setLastSelectedPeriod] = useState<string>('')

  useEffect(() => {
    if (selectedPeriod) {
      setLastSelectedPeriod(selectedPeriod)
    }
  }, [selectedPeriod])

  const selectValue = selectedPeriod || lastSelectedPeriod

  const [dayPickerRange, setDayPickerRange] = useState<DayPickerRange | undefined>(() => {
    if (initialRange?.startDate && initialRange.endDate) {
      return { from: initialRange.startDate.toDate(), to: initialRange.endDate.toDate() }
    }
    if (availablePeriods.length > 0) {
      return {
        from: availablePeriods[0].startDate.toDate(),
        to: availablePeriods[0].endDate.toDate()
      }
    }
    return undefined
  })
  const [showSelect, setShowSelect] = useState(true)
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (availablePeriods.length > 0) {
      if (initialRange?.startDate && initialRange.endDate) {
        const matchingPeriod = availablePeriods.find((p) =>
          p.startDate.isSame(initialRange.startDate, 'day')
        )

        if (matchingPeriod) {
          setSelectedPeriod(matchingPeriod.value)
          setDayPickerRange({
            from: matchingPeriod.startDate.toDate(),
            to: matchingPeriod.endDate.toDate()
          })
        } else {
          const firstPeriod = availablePeriods[0]
          setSelectedPeriod(firstPeriod.value)
          setDayPickerRange({
            from: firstPeriod.startDate.toDate(),
            to: firstPeriod.endDate.toDate()
          })
          onChange({ startDate: firstPeriod.startDate, endDate: firstPeriod.endDate })
        }
      } else {
        const firstPeriod = availablePeriods[0]
        setSelectedPeriod(firstPeriod.value)
        setDayPickerRange({
          from: firstPeriod.startDate.toDate(),
          to: firstPeriod.endDate.toDate()
        })
        onChange({ startDate: firstPeriod.startDate, endDate: firstPeriod.endDate })
      }
    }
  }, [initialRange, availablePeriods, onChange])

  const handlePeriodChange = (event: any) => {
    const value = event.target.value
    console.log(`[PeriodSelect] Period changed to: ${value}`)
    setSelectedPeriod(value)

    const selectedHistoricalPeriod = availablePeriods.find((p) => p.value === value)
    if (selectedHistoricalPeriod) {
      setDayPickerRange({
        from: selectedHistoricalPeriod.startDate.toDate(),
        to: selectedHistoricalPeriod.endDate.toDate()
      })
      onChange({
        startDate: selectedHistoricalPeriod.startDate,
        endDate: selectedHistoricalPeriod.endDate
      })
    }
  }

  const handleReset = () => {
    if (availablePeriods.length > 0) {
      const firstPeriod = availablePeriods[0]
      setSelectedPeriod(firstPeriod.value)
      setDayPickerRange({
        from: firstPeriod.startDate.toDate(),
        to: firstPeriod.endDate.toDate()
      })
      onChange({ startDate: firstPeriod.startDate, endDate: firstPeriod.endDate })
    }
  }

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {}
  const handleClose = () => {}

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
        {periodsLoading ? (
          <Box
            className={styles.select}
            sx={{ paddingLeft: '12px', paddingRight: '12px' }}
          >
            <CircularProgress size={20} sx={{ marginRight: '8px' }} />
            <Typography variant="body2" color="textSecondary">
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
                <RestartAltIcon />
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
