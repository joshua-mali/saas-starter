import { NSWTermDate } from './schema';

// NSW Term Dates data extracted from NSW Education website
// Source: https://education.nsw.gov.au/schooling/calendars/future-and-past-nsw-term-and-vacation-dates

export const nswTermDatesData: Omit<NSWTermDate, 'id' | 'createdAt' | 'updatedAt'>[] = [
  // 2030 Eastern Division
  { calendarYear: 2030, termNumber: 1, termName: 'Term 1', startDate: '2030-01-31', endDate: '2030-04-12', division: 'Eastern' },
  { calendarYear: 2030, termNumber: 2, termName: 'Term 2', startDate: '2030-04-29', endDate: '2030-07-05', division: 'Eastern' },
  { calendarYear: 2030, termNumber: 3, termName: 'Term 3', startDate: '2030-07-22', endDate: '2030-09-27', division: 'Eastern' },
  { calendarYear: 2030, termNumber: 4, termName: 'Term 4', startDate: '2030-10-14', endDate: '2030-12-19', division: 'Eastern' },
  // 2030 Western Division
  { calendarYear: 2030, termNumber: 1, termName: 'Term 1', startDate: '2030-02-07', endDate: '2030-04-12', division: 'Western' },
  { calendarYear: 2030, termNumber: 2, termName: 'Term 2', startDate: '2030-04-29', endDate: '2030-07-05', division: 'Western' },
  { calendarYear: 2030, termNumber: 3, termName: 'Term 3', startDate: '2030-07-22', endDate: '2030-09-27', division: 'Western' },
  { calendarYear: 2030, termNumber: 4, termName: 'Term 4', startDate: '2030-10-14', endDate: '2030-12-19', division: 'Western' },

  // 2029 Eastern Division
  { calendarYear: 2029, termNumber: 1, termName: 'Term 1', startDate: '2029-01-29', endDate: '2029-04-13', division: 'Eastern' },
  { calendarYear: 2029, termNumber: 2, termName: 'Term 2', startDate: '2029-04-30', endDate: '2029-07-06', division: 'Eastern' },
  { calendarYear: 2029, termNumber: 3, termName: 'Term 3', startDate: '2029-07-23', endDate: '2029-09-28', division: 'Eastern' },
  { calendarYear: 2029, termNumber: 4, termName: 'Term 4', startDate: '2029-10-15', endDate: '2029-12-20', division: 'Eastern' },
  // 2029 Western Division
  { calendarYear: 2029, termNumber: 1, termName: 'Term 1', startDate: '2029-02-05', endDate: '2029-04-13', division: 'Western' },
  { calendarYear: 2029, termNumber: 2, termName: 'Term 2', startDate: '2029-04-30', endDate: '2029-07-06', division: 'Western' },
  { calendarYear: 2029, termNumber: 3, termName: 'Term 3', startDate: '2029-07-23', endDate: '2029-09-28', division: 'Western' },
  { calendarYear: 2029, termNumber: 4, termName: 'Term 4', startDate: '2029-10-15', endDate: '2029-12-20', division: 'Western' },

  // 2028 Eastern Division
  { calendarYear: 2028, termNumber: 1, termName: 'Term 1', startDate: '2028-01-31', endDate: '2028-04-07', division: 'Eastern' },
  { calendarYear: 2028, termNumber: 2, termName: 'Term 2', startDate: '2028-04-24', endDate: '2028-07-07', division: 'Eastern' },
  { calendarYear: 2028, termNumber: 3, termName: 'Term 3', startDate: '2028-07-24', endDate: '2028-09-29', division: 'Eastern' },
  { calendarYear: 2028, termNumber: 4, termName: 'Term 4', startDate: '2028-10-16', endDate: '2028-12-21', division: 'Eastern' },
  // 2028 Western Division
  { calendarYear: 2028, termNumber: 1, termName: 'Term 1', startDate: '2028-02-07', endDate: '2028-04-07', division: 'Western' },
  { calendarYear: 2028, termNumber: 2, termName: 'Term 2', startDate: '2028-04-24', endDate: '2028-07-07', division: 'Western' },
  { calendarYear: 2028, termNumber: 3, termName: 'Term 3', startDate: '2028-07-24', endDate: '2028-09-29', division: 'Western' },
  { calendarYear: 2028, termNumber: 4, termName: 'Term 4', startDate: '2028-10-16', endDate: '2028-12-21', division: 'Western' },

  // 2027 Eastern Division
  { calendarYear: 2027, termNumber: 1, termName: 'Term 1', startDate: '2027-01-28', endDate: '2027-04-09', division: 'Eastern' },
  { calendarYear: 2027, termNumber: 2, termName: 'Term 2', startDate: '2027-04-26', endDate: '2027-07-02', division: 'Eastern' },
  { calendarYear: 2027, termNumber: 3, termName: 'Term 3', startDate: '2027-07-19', endDate: '2027-09-24', division: 'Eastern' },
  { calendarYear: 2027, termNumber: 4, termName: 'Term 4', startDate: '2027-10-11', endDate: '2027-12-20', division: 'Eastern' },
  // 2027 Western Division
  { calendarYear: 2027, termNumber: 1, termName: 'Term 1', startDate: '2027-02-04', endDate: '2027-04-09', division: 'Western' },
  { calendarYear: 2027, termNumber: 2, termName: 'Term 2', startDate: '2027-04-26', endDate: '2027-07-02', division: 'Western' },
  { calendarYear: 2027, termNumber: 3, termName: 'Term 3', startDate: '2027-07-19', endDate: '2027-09-24', division: 'Western' },
  { calendarYear: 2027, termNumber: 4, termName: 'Term 4', startDate: '2027-10-11', endDate: '2027-12-20', division: 'Western' },

  // 2026 Eastern Division
  { calendarYear: 2026, termNumber: 1, termName: 'Term 1', startDate: '2026-02-05', endDate: '2026-04-10', division: 'Eastern' },
  { calendarYear: 2026, termNumber: 2, termName: 'Term 2', startDate: '2026-04-29', endDate: '2026-07-03', division: 'Eastern' },
  { calendarYear: 2026, termNumber: 3, termName: 'Term 3', startDate: '2026-07-21', endDate: '2026-09-25', division: 'Eastern' },
  { calendarYear: 2026, termNumber: 4, termName: 'Term 4', startDate: '2026-10-13', endDate: '2026-12-18', division: 'Eastern' },
  // 2026 Western Division
  { calendarYear: 2026, termNumber: 1, termName: 'Term 1', startDate: '2026-02-12', endDate: '2026-04-10', division: 'Western' },
  { calendarYear: 2026, termNumber: 2, termName: 'Term 2', startDate: '2026-04-29', endDate: '2026-07-03', division: 'Western' },
  { calendarYear: 2026, termNumber: 3, termName: 'Term 3', startDate: '2026-07-21', endDate: '2026-09-25', division: 'Western' },
  { calendarYear: 2026, termNumber: 4, termName: 'Term 4', startDate: '2026-10-13', endDate: '2026-12-18', division: 'Western' },

  // 2025 Eastern Division
  { calendarYear: 2025, termNumber: 1, termName: 'Term 1', startDate: '2025-02-06', endDate: '2025-04-11', division: 'Eastern' },
  { calendarYear: 2025, termNumber: 2, termName: 'Term 2', startDate: '2025-04-30', endDate: '2025-07-04', division: 'Eastern' },
  { calendarYear: 2025, termNumber: 3, termName: 'Term 3', startDate: '2025-07-22', endDate: '2025-09-26', division: 'Eastern' },
  { calendarYear: 2025, termNumber: 4, termName: 'Term 4', startDate: '2025-10-14', endDate: '2025-12-19', division: 'Eastern' },
  // 2025 Western Division
  { calendarYear: 2025, termNumber: 1, termName: 'Term 1', startDate: '2025-02-13', endDate: '2025-04-11', division: 'Western' },
  { calendarYear: 2025, termNumber: 2, termName: 'Term 2', startDate: '2025-04-30', endDate: '2025-07-04', division: 'Western' },
  { calendarYear: 2025, termNumber: 3, termName: 'Term 3', startDate: '2025-07-22', endDate: '2025-09-26', division: 'Western' },
  { calendarYear: 2025, termNumber: 4, termName: 'Term 4', startDate: '2025-10-14', endDate: '2025-12-19', division: 'Western' },
]; 