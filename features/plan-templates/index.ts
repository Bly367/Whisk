export {
  applyTemplateToWeek,
  previewApplyTemplate,
  undoApplyTemplate,
  type TemplateApplyPreview,
  type TemplateApplyPreviewEntry,
  type TemplateApplyResult,
} from '@/features/plan-templates/applyTemplate';

export {
  saveSelectionAsTemplate,
  saveWeekAsTemplate,
  planDateForOffset,
  type SaveSelectionAsTemplateInput,
  type SaveWeekAsTemplateInput,
} from '@/features/plan-templates/saveTemplate';

export {
  scheduleLeftovers,
  undoScheduleLeftovers,
  isLaterPlanDate,
  filterLaterWeekDates,
  defaultLaterTargetDate,
  type ScheduleLeftoversInput,
  type ScheduleLeftoversResult,
  type WeekDateOption,
} from '@/features/plan-templates/leftoversWorkflow';
