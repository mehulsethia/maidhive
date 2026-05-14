export const NEW_CLEANER_COMPLETED_JOBS_THRESHOLD = 5

export function isNewCleanerByCompletedJobs(completedJobs: number): boolean {
  return completedJobs < NEW_CLEANER_COMPLETED_JOBS_THRESHOLD
}

