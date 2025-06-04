import { PeriodOption } from '@/services/historyService'
import { DateRange } from './index'
import { DateRange as DayPickerRange } from 'react-day-picker'

type SetSelectedPeriodType = (value: string) => void
type SetDayPickerRangeType = (range: DayPickerRange | undefined) => void
type OnChangeType = (range: DateRange) => void

export const usePeriodSelectionHandlers = (
  availablePeriods: PeriodOption[],
  setSelectedPeriod: SetSelectedPeriodType,
  setDayPickerRange: SetDayPickerRangeType,
  onChange: OnChangeType
) => {
  const handlePeriodChange = (event: any) => {
    const value = event.target.value as string
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

  return { handlePeriodChange, handleReset }
}
