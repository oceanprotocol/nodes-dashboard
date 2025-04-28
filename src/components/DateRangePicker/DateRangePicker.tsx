import React, { useState } from 'react'
import { Box, Button, Popover, Typography } from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import dayjs, { Dayjs } from 'dayjs'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'

export interface DateRange {
  startDate: Dayjs | null
  endDate: Dayjs | null
}

interface DateRangePickerProps {
  onChange: (range: DateRange) => void
  initialRange?: DateRange
}

const PRESET_RANGES = [
  { label: '24h', days: 1 },
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: 'YTD', days: dayjs().diff(dayjs().startOf('year'), 'day') },
  { label: '1y', days: 365 }
]

const THEME = {
  colors: {
    primary: '#CF1FB1',
    dark: '#0E001A',
    white: '#FFFFFF',
    // Gradients
    mainGradient:
      'linear-gradient(135deg, rgba(14, 0, 26, 0.95) 0%, rgba(207, 31, 177, 0.15) 100%)',
    hoverGradient:
      'linear-gradient(135deg, rgba(14, 0, 26, 0.98) 0%, rgba(207, 31, 177, 0.25) 100%)',
    popoverGradient:
      'linear-gradient(135deg, rgba(14, 0, 26, 0.98) 0%, rgba(14, 0, 26, 0.95) 100%)',
    overlayGradient:
      'linear-gradient(135deg, rgba(207, 31, 177, 0.1) 0%, transparent 100%)',
    // Transparencies
    primaryTransparent: 'rgba(207, 31, 177, 0.3)',
    primaryHover: 'rgba(207, 31, 177, 0.4)',
    primaryBorder: 'rgba(239, 8, 8, 0.91)',
    primaryBorderHover: 'rgba(207, 31, 177, 0.4)',
    darkTransparent: 'rgba(14, 0, 26, 0.4)'
  },
  effects: {
    blur: {
      light: 'blur(10px)',
      medium: 'blur(20px)',
      heavy: 'blur(40px)'
    },
    shadow: {
      primary: '0 4px 20px rgba(207, 31, 177, 0.1)',
      primaryHover: '0 4px 30px rgba(207, 31, 177, 0.2)',
      popover: '0 8px 32px rgba(207, 31, 177, 0.15)'
    }
  },
  typography: {
    fontFamily: "'Sharp Sans', sans-serif",
    sizes: {
      small: '13px',
      regular: '14px'
    },
    letterSpacing: '0.3px'
  },
  spacing: {
    button: '4px 12px',
    container: '10px 20px',
    popover: '20px'
  },
  radius: {
    small: '8px',
    medium: '12px',
    large: '16px'
  },
  animation: {
    fast: 'all 0.2s ease',
    normal: 'all 0.3s ease'
  }
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({ onChange, initialRange }) => {
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: initialRange?.startDate || dayjs().subtract(30, 'day'),
    endDate: initialRange?.endDate || dayjs()
  })
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const [activePreset, setActivePreset] = useState<string>('30d')

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handlePresetClick = (days: number, label: string) => {
    const newRange = {
      startDate: dayjs().subtract(days, 'day'),
      endDate: dayjs()
    }
    setDateRange(newRange)
    onChange(newRange)
    setActivePreset(label)
    handleClose()
  }

  const handleStartDateChange = (date: Dayjs | null) => {
    const newRange = { ...dateRange, startDate: date }
    setDateRange(newRange)
    onChange(newRange)
    setActivePreset('')
  }

  const handleEndDateChange = (date: Dayjs | null) => {
    const newRange = { ...dateRange, endDate: date }
    setDateRange(newRange)
    onChange(newRange)
    setActivePreset('')
  }

  const formatDateRange = () => {
    if (dateRange.startDate && dateRange.endDate) {
      return `${dateRange.startDate.format('MMM D')} - ${dateRange.endDate.format('MMM D, YYYY')}`
    }
    return 'Select date range'
  }

  const commonStyles = {
    '& .MuiOutlinedInput-root': {
      height: '40px',
      backgroundColor: THEME.colors.darkTransparent,
      fontFamily: THEME.typography.fontFamily,
      borderRadius: THEME.radius.medium,
      '& .MuiOutlinedInput-input': {
        color: THEME.colors.white,
        fontSize: THEME.typography.sizes.regular,
        fontWeight: 500,
        padding: THEME.spacing.button,
        fontFamily: THEME.typography.fontFamily,
        '&::placeholder': {
          color: `${THEME.colors.white}B3`
        }
      },
      '& .MuiOutlinedInput-notchedOutline': {
        borderColor: THEME.colors.primaryBorder,
        transition: THEME.animation.fast
      },
      '&:hover .MuiOutlinedInput-notchedOutline': {
        borderColor: THEME.colors.primaryBorderHover
      },
      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
        borderColor: THEME.colors.primaryHover,
        borderWidth: '1px'
      },
      '& .MuiInputAdornment-root .MuiSvgIcon-root': {
        color: THEME.colors.primary
      }
    },
    '& .MuiFormLabel-root': {
      color: `${THEME.colors.white}B3`,
      fontFamily: THEME.typography.fontFamily,
      '&.Mui-focused': {
        color: THEME.colors.primary
      }
    }
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box
        onClick={handleClick}
        sx={{
          background: THEME.colors.mainGradient,
          backdropFilter: THEME.effects.blur.medium,
          WebkitBackdropFilter: THEME.effects.blur.medium,
          borderRadius: THEME.radius.large,
          padding: THEME.spacing.container,
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          transition: THEME.animation.normal,
          border: `1px solid ${THEME.colors.primaryBorder}`,
          boxShadow: THEME.effects.shadow.primary,
          '&:hover': {
            border: `1px solid ${THEME.colors.primaryBorderHover}`,
            background: THEME.colors.hoverGradient,
            boxShadow: THEME.effects.shadow.primaryHover
          }
        }}
      >
        <Typography
          sx={{
            color: THEME.colors.white,
            fontSize: THEME.typography.sizes.regular,
            fontWeight: 500,
            marginRight: '12px',
            fontFamily: THEME.typography.fontFamily,
            letterSpacing: THEME.typography.letterSpacing
          }}
        >
          {formatDateRange()}
        </Typography>
        <KeyboardArrowDownIcon
          sx={{
            color: THEME.colors.primary,
            transition: THEME.animation.normal,
            transform: Boolean(anchorEl) ? 'rotate(180deg)' : 'none'
          }}
        />
      </Box>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left'
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left'
        }}
        PaperProps={{
          sx: {
            mt: 1,
            background: THEME.colors.popoverGradient,
            backdropFilter: THEME.effects.blur.heavy,
            border: `1px solid ${THEME.colors.primaryBorder}`,
            borderRadius: THEME.radius.large,
            boxShadow: THEME.effects.shadow.popover,
            padding: THEME.spacing.popover,
            '&:before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: THEME.radius.large,
              background: THEME.colors.overlayGradient,
              pointerEvents: 'none'
            }
          }
        }}
      >
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            mb: 3,
            flexWrap: 'wrap',
            justifyContent: 'center'
          }}
        >
          {PRESET_RANGES.map(({ label, days }) => (
            <Button
              key={label}
              onClick={() => handlePresetClick(days, label)}
              variant={activePreset === label ? 'contained' : 'outlined'}
              size="small"
              sx={{
                minWidth: '60px',
                color: THEME.colors.white,
                borderColor: THEME.colors.primaryBorder,
                backgroundColor:
                  activePreset === label
                    ? THEME.colors.primaryTransparent
                    : 'transparent',
                backdropFilter:
                  activePreset === label ? THEME.effects.blur.light : 'none',
                fontFamily: THEME.typography.fontFamily,
                fontSize: THEME.typography.sizes.small,
                padding: THEME.spacing.button,
                borderRadius: THEME.radius.small,
                textTransform: 'none',
                letterSpacing: THEME.typography.letterSpacing,
                transition: THEME.animation.fast,
                '&:hover': {
                  backgroundColor:
                    activePreset === label
                      ? THEME.colors.primaryHover
                      : THEME.colors.primaryTransparent,
                  borderColor: THEME.colors.primaryBorderHover
                }
              }}
            >
              {label}
            </Button>
          ))}
        </Box>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <DatePicker
            label="Start Date"
            value={dateRange.startDate}
            onChange={handleStartDateChange}
            maxDate={dateRange.endDate || undefined}
            slotProps={{
              textField: {
                sx: commonStyles
              }
            }}
          />
          <DatePicker
            label="End Date"
            value={dateRange.endDate}
            onChange={handleEndDateChange}
            minDate={dateRange.startDate || undefined}
            maxDate={dayjs()}
            slotProps={{
              textField: {
                sx: commonStyles
              }
            }}
          />
        </Box>
      </Popover>
    </LocalizationProvider>
  )
}

export default DateRangePicker
