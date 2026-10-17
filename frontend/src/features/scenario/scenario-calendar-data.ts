import data from './trading-calendar.json'
import { isTradingCalendar } from './scenario-calendar'
import type { TradingCalendar } from './scenario-types'
// Only a source-backed, explicitly covered calendar may supply future dates.
export const scenarioCalendar: TradingCalendar | null = isTradingCalendar(data) ? data : null
