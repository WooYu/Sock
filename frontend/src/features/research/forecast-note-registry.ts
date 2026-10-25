import catalog from '../knowledge/note-tag-catalog.json'
import type { NoteTagRecord } from '../knowledge/note-tags'
import { forecastRegistryForRecords } from '../knowledge/note-forecast-classification'
import { buildScenarioRuleRegistry } from '../scenario/scenario-rule-registry'

// Loaded separately from market inputs. Only existing, source-bound definitions execute.
const records = catalog.fragments as NoteTagRecord[]
export const forecastNoteRegistry = forecastRegistryForRecords(records, buildScenarioRuleRegistry(records))
