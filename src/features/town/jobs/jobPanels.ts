// The job's sheets, each a chunk of its own (loaded when the job first needs it).
import { lazy } from 'react';

export const JobNotebook = lazy(() => import('./JobNotebook'));
export const JobPassword = lazy(() => import('./JobPassword'));
export const JobDebrief = lazy(() => import('./JobDebrief'));
