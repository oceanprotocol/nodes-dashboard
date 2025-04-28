import axios from 'axios'
import { getApiRoute } from '@/config'

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

export interface WeekStatsItem {
  _index: string
  _id: string
  _score: number
  _source: {
    id: number
    week: number
    totalUptime: number
    lastRun: number
    round: number
    timestamp: number
  }
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

export const getWeekStats = async (date: number) => {
  try {
    const response = await axios.get<WeekStatsItem[]>(
      `${getApiRoute('weekStats')}?date=${date}`
    )
    return response.data?.length > 0 ? response.data[0]._source : null
  } catch (error) {
    console.error('Error fetching week stats:', error)
    throw error
  }
}

export const getThursdayDates = (startDate: Date = new Date()) => {
  const dates = []
  let currentDate = new Date(startDate)

  while (currentDate.getDay() !== 4) {
    currentDate.setDate(currentDate.getDate() - 1)
  }

  for (let i = 0; i < 4; i++) {
    const thursday = new Date(currentDate)
    dates.unshift({
      label: `From ${thursday.toLocaleDateString()} to ${new Date(thursday.getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}`,
      value: Math.floor(thursday.getTime() / 1000),
      startDate: thursday,
      endDate: new Date(thursday.getTime() + 7 * 24 * 60 * 60 * 1000)
    })
    currentDate.setDate(currentDate.getDate() - 7)
  }

  return dates
}

export const formatPeriodLabel = (startDate: Date, endDate: Date) => {
  return `From ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`
}
