import { useState, useEffect } from 'react'
import { DateRange as DayPickerRange } from 'react-day-picker'
import { PeriodOption } from '@/services/historyService'
import { DateRange } from './index'

export const useInitializePeriodState = (
  initialRange?: DateRange,
  availablePeriods: PeriodOption[] = [],
  onChange?: (range: DateRange) => void
) => {
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

  const [dayPickerRange, setDayPickerRange] = useState<DayPickerRange | undefined>(() => {
    if (initialRange?.startDate && initialRange.endDate) {
      return { from: initialRange.startDate.toDate(), to: initialRange.endDate.toDate() }
    }
    if (
      availablePeriods.length > 0 &&
      availablePeriods[0].startDate &&
      availablePeriods[0].endDate
    ) {
      return {
        from: availablePeriods[0].startDate.toDate(),
        to: availablePeriods[0].endDate.toDate()
      }
    }
    return undefined
  })

  useEffect(() => {
    if (availablePeriods.length > 0 && onChange) {
      let activePeriodValue = ''
      let activeDayPickerRange: DayPickerRange | undefined = undefined
      let activeDateRange: DateRange | null = null

      if (initialRange?.startDate && initialRange.endDate) {
        const matchingPeriod = availablePeriods.find((p) =>
          p.startDate.isSame(initialRange.startDate, 'day')
        )

        if (matchingPeriod) {
          activePeriodValue = matchingPeriod.value
          activeDayPickerRange = {
            from: matchingPeriod.startDate.toDate(),
            to: matchingPeriod.endDate.toDate()
          }
        } else {
          const firstPeriod = availablePeriods[0]
          activePeriodValue = firstPeriod.value
          activeDayPickerRange = {
            from: firstPeriod.startDate.toDate(),
            to: firstPeriod.endDate.toDate()
          }
          activeDateRange = {
            startDate: firstPeriod.startDate,
            endDate: firstPeriod.endDate
          }
        }
      } else {
        const firstPeriod = availablePeriods[0]
        activePeriodValue = firstPeriod.value
        activeDayPickerRange = {
          from: firstPeriod.startDate.toDate(),
          to: firstPeriod.endDate.toDate()
        }
        activeDateRange = {
          startDate: firstPeriod.startDate,
          endDate: firstPeriod.endDate
        }
      }

      setSelectedPeriod(activePeriodValue)
      setDayPickerRange(activeDayPickerRange)
      if (activeDateRange) {
        onChange(activeDateRange)
      }
    }
  }, [
    initialRange?.startDate?.valueOf(),
    initialRange?.endDate?.valueOf(),
    availablePeriods,
    onChange
  ])

  return {
    selectedPeriod,
    setSelectedPeriod,
    dayPickerRange,
    setDayPickerRange
  }
}
