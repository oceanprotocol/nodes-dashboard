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

const PRESET_PERIODS = [
  { label: '1 Day', value: '1d', days: 1 },
  { label: '3 Days', value: '3d', days: 3 },
  { label: '1 Week', value: '1w', days: 7 },
  { label: '1 Month', value: '1m', days: 30 },
  { label: 'Custom', value: 'custom', days: 0 }
]

const PeriodSelect: React.FC<PeriodSelectProps> = ({
  onChange,
  initialRange,
  availablePeriods,
  periodsLoading = false
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<string>(() => {
    if (initialRange?.startDate) {
      return initialRange.startDate.valueOf().toString()
    }
    return '1m'
  })

  const [dayPickerRange, setDayPickerRange] = useState<DayPickerRange | undefined>(() => {
    if (initialRange?.startDate && initialRange.endDate) {
      return { from: initialRange.startDate.toDate(), to: initialRange.endDate.toDate() }
    }
    const defaultPreset = PRESET_PERIODS.find((p) => p.value === '1m')
    if (defaultPreset) {
      return {
        from: dayjs().subtract(defaultPreset.days, 'day').toDate(),
        to: dayjs().toDate()
      }
    }
    return undefined
  })

  const [showSelect, setShowSelect] = useState(true)
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (initialRange?.startDate && initialRange.endDate) {
      const initialValue = initialRange.startDate.valueOf().toString()
      const foundInAvailable = availablePeriods.find((p) => p.value === initialValue)
      const foundInPresets = PRESET_PERIODS.find(
        (p) =>
          p.days > 0 &&
          initialRange.endDate?.isSame(dayjs(), 'day') &&
          initialRange.startDate?.isSame(dayjs().subtract(p.days, 'day'), 'day')
      )

      if (foundInAvailable) {
        setSelectedPeriod(foundInAvailable.value)
        setShowSelect(true)
      } else if (foundInPresets) {
        setSelectedPeriod(foundInPresets.value)
        setShowSelect(true)
      } else {
        setSelectedPeriod('custom')
        setShowSelect(false)
      }
      setDayPickerRange({
        from: initialRange.startDate.toDate(),
        to: initialRange.endDate.toDate()
      })
    } else if (
      !periodsLoading &&
      availablePeriods.length > 0 &&
      !initialRange?.startDate
    ) {
      const firstPeriod = availablePeriods[0]
      setSelectedPeriod(firstPeriod.value)
      setDayPickerRange({
        from: firstPeriod.startDate.toDate(),
        to: firstPeriod.endDate.toDate()
      })
      onChange({ startDate: firstPeriod.startDate, endDate: firstPeriod.endDate })
      setShowSelect(true)
    }
  }, [initialRange, availablePeriods, periodsLoading, onChange])

  const handlePeriodChange = (event: any) => {
    const value = event.target.value
    setSelectedPeriod(value)
    setShowSelect(true)

    if (value === 'custom') {
      setShowSelect(false)
      if (!anchorEl) {
        const selectElement = document.querySelector(`.${styles.select}`)
        if (selectElement) {
          ;(selectElement as HTMLElement).click()
        }
      }
      return
    }

    const presetPeriod = PRESET_PERIODS.find((p) => p.value === value)
    if (presetPeriod) {
      const newFrom = dayjs().subtract(presetPeriod.days, 'day')
      const newTo = dayjs()
      setDayPickerRange({ from: newFrom.toDate(), to: newTo.toDate() })
      onChange({ startDate: newFrom, endDate: newTo })
      return
    }

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

  const handleRangeSelect = (range: DayPickerRange | undefined) => {
    setDayPickerRange(range)
    if (range?.from && range?.to) {
      onChange({
        startDate: dayjs(range.from),
        endDate: dayjs(range.to)
      })
      setSelectedPeriod('custom')
      setShowSelect(false)
      handleClose()
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
    } else {
      const defaultPreset =
        PRESET_PERIODS.find((p) => p.value === '1m') || PRESET_PERIODS[0]
      setSelectedPeriod(defaultPreset.value)
      const newFrom = dayjs().subtract(defaultPreset.days, 'day')
      const newTo = dayjs()
      setDayPickerRange({ from: newFrom.toDate(), to: newTo.toDate() })
      onChange({ startDate: newFrom, endDate: newTo })
    }
    setShowSelect(true)
    handleClose()
  }

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    if (!periodsLoading) {
      setAnchorEl(event.currentTarget)
    }
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const formatDateRangeText = useMemo(() => {
    if (dayPickerRange?.from && dayPickerRange?.to) {
      return `From ${dayjs(dayPickerRange.from).format('MMM D, YYYY')} to ${dayjs(dayPickerRange.to).format('MMM D, YYYY')}`
    }
    if (initialRange?.startDate && initialRange.endDate) {
      return `From ${initialRange.startDate.format('MMM D, YYYY')} to ${initialRange.endDate.format('MMM D, YYYY')}`
    }
    return 'Select Period'
  }, [dayPickerRange, initialRange])

  const currentLabel = useMemo(() => {
    if (selectedPeriod === 'custom') return formatDateRangeText
    const preset = PRESET_PERIODS.find((p) => p.value === selectedPeriod)
    if (preset) return preset.label
    const historical = availablePeriods.find((p) => p.value === selectedPeriod)
    if (historical) return historical.label
    return formatDateRangeText
  }, [selectedPeriod, availablePeriods, formatDateRangeText])

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
        ) : showSelect ? (
          <Select
            value={selectedPeriod}
            onChange={handlePeriodChange}
            className={styles.select}
            IconComponent={KeyboardArrowDownIcon}
            displayEmpty
            renderValue={(value) => currentLabel}
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
            {PRESET_PERIODS.map((period) => (
              <MenuItem
                key={period.value}
                value={period.value}
                className={styles.menuItem}
              >
                {period.label}
              </MenuItem>
            ))}
            {availablePeriods.length > 0 ? <Divider className={styles.divider} /> : null}
            {availablePeriods.map((period) => (
              <Tooltip
                key={period.value}
                title={`Round ${period.weekIdentifier} - Incentive period running from ${period.startDate.format('MMM D, YYYY')} to ${period.endDate.format('MMM D, YYYY')}`}
                placement="right"
                arrow
                sx={{
                  '& .MuiTooltip-tooltip': {
                    backgroundColor: '#1A0820',
                    color: 'white',
                    fontSize: '0.8rem',
                    padding: '8px 12px',
                    maxWidth: 300,
                    border: '1px solid rgba(207, 31, 177, 0.3)',
                    boxShadow: '0 4px 20px rgba(207, 31, 177, 0.3)'
                  },
                  '& .MuiTooltip-arrow': {
                    color: '#1A0820'
                  }
                }}
              >
                <MenuItem value={period.value} className={styles.menuItem}>
                  {period.label}
                </MenuItem>
              </Tooltip>
            ))}
          </Select>
        ) : (
          <Box className={styles.select} onClick={handleClick} sx={{ cursor: 'pointer' }}>
            <Typography className={styles.dateText}>{formatDateRangeText}</Typography>
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
      </FormControl>

      <Popover
        open={Boolean(anchorEl) && !periodsLoading}
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
          defaultMonth={
            dayPickerRange?.from ?? initialRange?.startDate?.toDate() ?? new Date()
          }
          selected={dayPickerRange}
          onSelect={handleRangeSelect}
          numberOfMonths={2}
          className={styles.dayPicker}
          disabled={periodsLoading}
        />
      </Popover>
    </Box>
  )
}

export default PeriodSelect
