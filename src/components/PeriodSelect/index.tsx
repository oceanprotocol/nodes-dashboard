import React, { useState, useEffect } from 'react'
import {
  Select,
  MenuItem,
  FormControl,
  Box,
  IconButton,
  Typography,
  Popover,
  Divider
} from '@mui/material'
import { DayPicker, DateRange as DayPickerRange } from 'react-day-picker'
import 'react-day-picker/dist/style.css'
import CloseIcon from '@mui/icons-material/Close'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import dayjs, { Dayjs } from 'dayjs'
import styles from './styles.module.css'
import { getThursdayDates } from '@/services/historyService'

export interface DateRange {
  startDate: Dayjs | null
  endDate: Dayjs | null
}

interface PeriodSelectProps {
  onChange: (range: DateRange) => void
  initialRange?: DateRange
}

const PRESET_PERIODS = [
  { label: '1 Day', value: '1d', days: 1 },
  { label: '3 Days', value: '3d', days: 3 },
  { label: '1 Week', value: '1w', days: 7 },
  { label: '1 Month', value: '1m', days: 30 },
  { label: '1 Year', value: '1y', days: 365 },
  { label: 'Custom', value: 'custom', days: 0 }
]

const PeriodSelect: React.FC<PeriodSelectProps> = ({ onChange, initialRange }) => {
  const [selectedPeriod, setSelectedPeriod] = useState<string>('1m')
  const [thursdayPeriods, setThursdayPeriods] = useState<
    Array<{
      label: string
      value: number
      startDate: Date
      endDate: Date
    }>
  >([])
  const [dateRange, setDateRange] = useState<DayPickerRange | undefined>({
    from: initialRange?.startDate?.toDate() || dayjs().subtract(30, 'day').toDate(),
    to: initialRange?.endDate?.toDate() || dayjs().toDate()
  })
  const [showSelect, setShowSelect] = useState(true)
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

  useEffect(() => {
    // Get the Thursday dates when component mounts
    const thursdays = getThursdayDates()
    setThursdayPeriods(thursdays)
  }, [])

  const handlePeriodChange = (event: any) => {
    const value = event.target.value
    setSelectedPeriod(value)

    if (value === 'custom') {
      setShowSelect(false)
      return
    }

    // Check if it's a preset period
    const presetPeriod = PRESET_PERIODS.find((p) => p.value === value)
    if (presetPeriod) {
      const newRange = {
        from: dayjs().subtract(presetPeriod.days, 'day').toDate(),
        to: dayjs().toDate()
      }
      setDateRange(newRange)
      onChange({
        startDate: dayjs(newRange.from),
        endDate: dayjs(newRange.to)
      })
      return
    }

    // Check if it's a Thursday period
    const thursdayPeriod = thursdayPeriods.find((p) => p.value.toString() === value)
    if (thursdayPeriod) {
      onChange({
        startDate: dayjs(thursdayPeriod.startDate),
        endDate: dayjs(thursdayPeriod.endDate)
      })
      setDateRange({
        from: thursdayPeriod.startDate,
        to: thursdayPeriod.endDate
      })
    }
  }

  const handleRangeSelect = (range: DayPickerRange | undefined) => {
    setDateRange(range)
    if (range?.from && range?.to) {
      onChange({
        startDate: dayjs(range.from),
        endDate: dayjs(range.to)
      })
    }
  }

  const handleReset = () => {
    setSelectedPeriod('1m')
    setShowSelect(true)
    const newRange = {
      from: dayjs().subtract(30, 'day').toDate(),
      to: dayjs().toDate()
    }
    setDateRange(newRange)
    onChange({
      startDate: dayjs(newRange.from),
      endDate: dayjs(newRange.to)
    })
  }

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const formatDateRange = () => {
    if (dateRange?.from && dateRange?.to) {
      return `From ${dayjs(dateRange.from).format('MMM D')} to ${dayjs(dateRange.to).format('MMM D')}`
    }
    return ''
  }

  return (
    <Box className={styles.container}>
      <FormControl>
        <Box className={styles.selectWrapper}>
          {showSelect ? (
            <Select
              value={selectedPeriod}
              onChange={handlePeriodChange}
              className={styles.select}
              IconComponent={KeyboardArrowDownIcon}
              MenuProps={{
                classes: { paper: styles.menu }
              }}
              endAdornment={
                <IconButton
                  onClick={handleReset}
                  className={styles.resetButton}
                  size="small"
                >
                  <RestartAltIcon />
                </IconButton>
              }
            >
              {PRESET_PERIODS.map((period) => (
                <MenuItem
                  key={period.value}
                  value={period.value}
                  className={styles.menuItem}
                >
                  {period.label}
                </MenuItem>
              ))}
              {thursdayPeriods.length > 0 && <Divider />}
              {thursdayPeriods.map((period) => (
                <MenuItem
                  key={period.value}
                  value={period.value.toString()}
                  className={styles.menuItem}
                >
                  {period.label}
                </MenuItem>
              ))}
            </Select>
          ) : (
            <Box className={styles.select} onClick={handleClick}>
              <Typography className={styles.dateText}>{formatDateRange()}</Typography>
              <Box className={styles.iconWrapper}>
                <KeyboardArrowDownIcon className={styles.selectIcon} />
              </Box>
              <IconButton
                onClick={(e) => {
                  e.stopPropagation()
                  handleReset()
                }}
                className={styles.resetButton}
                size="small"
              >
                <CloseIcon />
              </IconButton>
            </Box>
          )}
        </Box>
      </FormControl>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right'
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right'
        }}
        PaperProps={{
          className: styles.datePickerPopover
        }}
      >
        <DayPicker
          mode="range"
          defaultMonth={dateRange?.from}
          selected={dateRange}
          onSelect={handleRangeSelect}
          numberOfMonths={2}
          className={styles.dayPicker}
        />
      </Popover>
    </Box>
  )
}

export default PeriodSelect
