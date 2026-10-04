/** Window events for the guided tour. Tiny and dependency-free, so any component can start it. */
export const START_TOUR_EVENT = "app:start-tour";
export const TOUR_STEP_EVENT = "app:tour-step";

export type TourStepDetail = { index: number; total: number; sectionId: string | null };

/** Starts the 60-second tour (on the home page; elsewhere the host takes you there first). */
export const startTour = () => window.dispatchEvent(new CustomEvent(START_TOUR_EVENT));
