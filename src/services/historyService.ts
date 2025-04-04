import axios from 'axios'
import { getApiRoute } from '@/config'

export interface NodeHistoryResponse {
  roundNo: number
  timestamp: string
  reasonForIssue: string
  status: string
}

export interface WeekStatsResponse {
  _source: {
    totalUptime: number
    roundsCompleted: number
    currentRound: number
    epochStart: number
    epochEnd: number
  }
}

export const getNodeHistory = async (
  nodeId: string,
  date: number,
  page = 1,
  size = 100
) => {
  try {
    const response = await axios.get(
      `${getApiRoute('history')}/?nodeId=${nodeId}&page=${page}&size=${size}&date=${date}`
    )
    return response.data
  } catch (error) {
    console.error('Error fetching node history:', error)
    throw error
  }
}

export const getWeekStats = async (date: number) => {
  try {
    const response = await axios.get<WeekStatsResponse[]>(
      `${getApiRoute('weekStats')}?date=${date}`
    )
    return response.data
  } catch (error) {
    console.error('Error fetching week stats:', error)
    throw error
  }
}

// Helper function to get Thursday dates for a given range
export const getThursdayDates = (startDate: Date = new Date()) => {
  const dates = []
  let currentDate = new Date(startDate)

  // Go back to find the most recent Thursday
  while (currentDate.getDay() !== 4) {
    // 4 is Thursday
    currentDate.setDate(currentDate.getDate() - 1)
  }

  // Get the last 4 Thursdays
  for (let i = 0; i < 4; i++) {
    const thursday = new Date(currentDate)
    dates.unshift({
      label: `From ${thursday.toLocaleDateString()} to ${new Date(thursday.getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}`,
      value: Math.floor(thursday.getTime() / 1000), // Convert to epoch timestamp
      startDate: thursday,
      endDate: new Date(thursday.getTime() + 7 * 24 * 60 * 60 * 1000)
    })
    currentDate.setDate(currentDate.getDate() - 7)
  }

  return dates
}

// Helper function to format the period for display
export const formatPeriodLabel = (startDate: Date, endDate: Date) => {
  return `From ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`
}
