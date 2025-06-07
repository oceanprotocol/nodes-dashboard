import axios from 'axios'
import { getApiRoute } from '@/config'
import dayjs, { Dayjs } from 'dayjs'

export interface NodeHistoryItem {
  peerId: string
  errorCause: string
  deltaTime: number
  epoch: number
  round: number
  timestamp: number
}

export interface HistoryApiResponse {
  data: NodeHistoryItem[]
  pagination: {
    page: number
    size: number
    totalPages: number
    totalCount: number
  }
}

export interface WeekStatsSource {
  id: number
  week: number
  totalUptime: number
  lastRun: number
  round?: number
  timestamp?: number
}

export interface ApiWeekStatItem {
  _index: string
  _id: string
  _score: number
  _source: WeekStatsSource
}

export interface PeriodOption {
  label: string
  value: string
  startDate: Dayjs
  endDate: Dayjs
  weekIdentifier: number
}

export const getNodeHistory = async (
  nodeId: string,
  page = 1,
  size = 100,
  startDate?: Dayjs | null,
  endDate?: Dayjs | null
): Promise<HistoryApiResponse> => {
  try {
    let url = `${getApiRoute('history')}?nodeId=${nodeId}&page=${page}&size=${size}`

    if (startDate && endDate) {
      url += `&startDate=${startDate.unix()}&endDate=${endDate.unix()}`
    } else {
      console.log(`[historyService] No date range provided`)
    }

    const response = await axios.get<HistoryApiResponse>(url)

    return response.data
  } catch (error) {
    console.error('Error fetching node history:', error)
    throw error
  }
}

export const getWeekStats = async (date: number): Promise<WeekStatsSource | null> => {
  try {
    const response = await axios.get<ApiWeekStatItem[]>(
      `${getApiRoute('weekStats')}?date=${date}`
    )
    return response.data?.length > 0 ? response.data[0]._source : null
  } catch (error) {
    console.error('Error fetching week stats:', error)
    throw error
  }
}

export const getAllHistoricalWeeklyPeriods = async (): Promise<PeriodOption[]> => {
  try {
    const response = await axios.get<ApiWeekStatItem[]>(
      'https://incentive-backend.oceanprotocol.com/weekStats'
    )

    if (!response.data || !Array.isArray(response.data)) {
      console.error('Invalid data structure from all weekStats endpoint:', response.data)
      return []
    }

    const periods: PeriodOption[] = response.data.map((item) => {
      const lastRun = dayjs(item._source.lastRun).tz('CET')
      const weekIdentifier = item._source.week || parseInt(item._id, 10)

      const epochStart = dayjs('1970-01-01T00:00:00Z')
        .add(weekIdentifier * 7, 'day')
        .tz('CET')
      const epochEnd = epochStart.add(7, 'day')

      // Adjust lastRun if it's after the current epoch week
      const correctedDate = lastRun.isAfter(epochEnd)
        ? lastRun.subtract(3, 'day')
        : lastRun

      // Get the Thursday of that (corrected) week
      const dayOfWeek = correctedDate.day()
      const daysToSubtract = (dayOfWeek + 7 - 4) % 7 // back to previous Thursday
      const startDate = correctedDate.subtract(daysToSubtract, 'day').startOf('day')
      const endDate = startDate.add(7, 'day')

      return {
        label: `Round ${weekIdentifier} (Week of ${startDate.format('MMM D, YYYY')})`,
        value: startDate.valueOf().toString(),
        startDate,
        endDate,
        weekIdentifier
      }
    })

    periods.sort((a, b) => b.startDate.valueOf() - a.startDate.valueOf())

    return periods
  } catch (error) {
    console.error('Error fetching all historical weekly periods:', error)
    throw error
  }
}

export const getThursdayDates = (startDateInput: Date = new Date()) => {
  const dates = []
  let currentDate = dayjs(startDateInput)

  while (currentDate.day() !== 4) {
    currentDate = currentDate.subtract(1, 'day')
  }

  for (let i = 0; i < 4; i++) {
    const thursday = currentDate.startOf('day')
    const followingWednesday = thursday.add(6, 'days').endOf('day')

    dates.unshift({
      label: `Week of ${thursday.format('MMM D, YYYY')}`,
      value: thursday.valueOf(),
      startDate: thursday.toDate(),
      endDate: followingWednesday.toDate()
    })
    currentDate = currentDate.subtract(7, 'days')
  }

  return dates
}

export const formatPeriodLabel = (startDate: Date, endDate: Date) => {
  return `From ${dayjs(startDate).format('MMM D, YYYY')} to ${dayjs(endDate).format('MMM D, YYYY')}`
}

export interface RewardsData {
  date: string
  nrEligibleNodes: number
  totalAmount: number
}

/**
 * Fetches historical rewards data across all periods
 * @returns Array of rewards data objects
 */
export const getAllHistoricalRewards = async (): Promise<RewardsData[]> => {
  try {
    const response = await axios.get(`${getApiRoute('analyticsRewardsHistory')}`)

    return response.data?.rewards || []
  } catch (error) {
    console.error('Error fetching historical rewards data:', error)
    return []
  }
}

/**
 * Fetches the latest successfully processed week's stats (live round data).
 * This targets the Wednesday on or before the most recent Thursday.
 * @returns WeekStatsSource object or null if not found or in case of error.
 */
export const getCurrentWeekStats = async (): Promise<WeekStatsSource | null> => {
  try {
    const today = dayjs()
    let lastSunday = today.day() === 0 ? today.subtract(7, 'day') : today.day(0)

    lastSunday = lastSunday.startOf('day')
    const targetEpochSeconds = lastSunday.unix()

    console.log(
      `[getCurrentWeekStats] Attempting to fetch stats for last Sunday: ${lastSunday.format(
        'YYYY-MM-DD HH:mm:ss'
      )}, Epoch: ${targetEpochSeconds}`
    )

    let initialResponseData: ApiWeekStatItem[] | null = null
    try {
      const response = await axios.get<ApiWeekStatItem[]>(
        `${getApiRoute('weekStats')}?date=${targetEpochSeconds}`
      )
      if (response.data && Array.isArray(response.data)) {
        initialResponseData = response.data
      }
    } catch (initialError) {
      console.warn(
        `[getCurrentWeekStats] Error fetching stats for target epoch ${targetEpochSeconds}:`,
        initialError
      )
    }

    if (initialResponseData && initialResponseData.length > 0) {
      console.log(
        `[getCurrentWeekStats] Successfully fetched stats for target epoch ${targetEpochSeconds}.`
      )
      return initialResponseData[0]._source
    } else {
      console.warn(
        `[getCurrentWeekStats] No data for target epoch ${targetEpochSeconds} or initial fetch failed. Falling back to fetching latest available round.`
      )

      const fallbackResponse = await axios.get<ApiWeekStatItem[]>(
        getApiRoute('weekStats')
      )

      if (
        fallbackResponse.data &&
        Array.isArray(fallbackResponse.data) &&
        fallbackResponse.data.length > 0
      ) {
        const allRounds = fallbackResponse.data

        allRounds.sort((a, b) => (b._source.timestamp || 0) - (a._source.timestamp || 0))

        if (allRounds.length > 0) {
          console.log(
            `[getCurrentWeekStats] Successfully fetched latest available round via fallback. Latest round ID: ${allRounds[0]._id}, Timestamp: ${allRounds[0]._source.timestamp}`
          )
          return allRounds[0]._source
        } else {
          console.warn(
            '[getCurrentWeekStats] Fallback fetch returned empty data or no sortable rounds.'
          )
          return null
        }
      } else {
        console.error(
          '[getCurrentWeekStats] Fallback fetch failed or returned unexpected data structure. Data:',
          fallbackResponse.data
        )
        return null
      }
    }
  } catch (error) {
    console.error(
      '[getCurrentWeekStats] Overall error fetching current week stats:',
      error
    )
    return null
  }
}
