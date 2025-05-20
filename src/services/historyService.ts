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
  size = 100
): Promise<HistoryApiResponse> => {
  try {
    const response = await axios.get<HistoryApiResponse>(
      `${getApiRoute('history')}?nodeId=${nodeId}&page=${page}&size=${size}`
    )
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
      'https://incentive-backend.oceanprotocol.io/weekStats'
    )

    if (!response.data || !Array.isArray(response.data)) {
      console.error('Invalid data structure from all weekStats endpoint:', response.data)
      return []
    }

    const periods: PeriodOption[] = response.data.map((item) => {
      const startDate = dayjs(item._source.lastRun)

      const currentDay = startDate.day()
      let adjustedStartDate = startDate
      if (currentDay !== 4) {
        adjustedStartDate = startDate
          .subtract((currentDay + 7 - 4) % 7, 'day')
          .startOf('day')
      } else {
        adjustedStartDate = startDate.startOf('day')
      }

      const endDate = adjustedStartDate.add(6, 'days').endOf('day')

      const weekIdentifier = item._source.week || parseInt(item._id, 10)

      return {
        label: `Round ${weekIdentifier} (Week of ${adjustedStartDate.format('MMM D, YYYY')})`,
        value: adjustedStartDate.valueOf().toString(),
        startDate: adjustedStartDate,
        endDate: endDate,
        weekIdentifier: weekIdentifier
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
 * Fetches the current week's stats (live round)
 * @returns Current week stats
 */
export const getCurrentWeekStats = async (): Promise<any> => {
  try {
    const allRewards = await getAllHistoricalRewards()

    let latestRound = '0'
    allRewards.forEach((reward) => {
      if (parseInt(reward.date) > parseInt(latestRound)) {
        latestRound = reward.date
      }
    })

    console.log(`Latest round from rewards data: ${latestRound}`)

    const response = await axios.get<ApiWeekStatItem[]>(
      `https://incentive-backend.oceanprotocol.io/weekStats?date=${latestRound}`
    )

    if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
      throw new Error('Invalid response from weekStats endpoint')
    }

    return response.data[0]._source
  } catch (error) {
    console.error('Error fetching current week stats:', error)

    try {
      const currentTimestamp = Date.now()
      const response = await axios.get<ApiWeekStatItem[]>(
        `https://incentive-backend.oceanprotocol.io/weekStats?date=${currentTimestamp}`
      )

      if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
        throw new Error('Invalid response from weekStats endpoint')
      }

      return response.data[0]._source
    } catch (fallbackError) {
      console.error('Error in fallback current week stats:', fallbackError)
      throw fallbackError
    }
  }
}
