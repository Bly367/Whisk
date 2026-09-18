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
  type ScheduleLeftoversInput,
  type ScheduleLeftoversResult,
} from '@/features/plan-templates/leftoversWorkflow';
