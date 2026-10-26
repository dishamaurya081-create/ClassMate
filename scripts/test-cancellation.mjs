/**
 * ClassMate Verification Script — Cancellation & Overlap Logic
 */

function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map((v) => parseInt(v, 10));
  return (h || 0) * 60 + (m || 0);
}

function isDateInRange(dateStr, startDate, endDate) {
  if (!dateStr || !startDate) return false;
  const end = endDate && endDate.trim() ? endDate.trim() : startDate;
  return dateStr >= startDate && dateStr <= end;
}

function doesScopeApply(target, classItem, userScope) {
  if (target.affectedSection && target.affectedSection.trim()) {
    const sec = target.affectedSection.trim();
    if (classItem.section !== sec) return false;
    if (userScope?.section && userScope.section !== sec) return false;
  }

  if (target.affectedBatch && target.affectedBatch.trim()) {
    const batch = target.affectedBatch.trim();
    if (classItem.batch && classItem.batch !== batch) {
      const isBatchMatch =
        (batch === 'DV Batch 1' && classItem.batch === 'Batch-1') ||
        (batch === 'DV Batch 2' && classItem.batch === 'Batch-2') ||
        (batch === 'Cloud' && classItem.batch === 'FCC') ||
        (batch === 'Group 1' && classItem.batch === 'G1') ||
        (batch === 'Group 2' && classItem.batch === 'G2') ||
        classItem.batch === batch;
      if (!isBatchMatch) return false;
    }
    if (userScope?.specializationOption && userScope.specializationOption !== batch) {
      if (batch === 'DV Batch 1' || batch === 'DV Batch 2' || batch === 'Cloud') {
        return false;
      }
    }
  }

  if (target.affectedGroup && target.affectedGroup.trim()) {
    const grp = target.affectedGroup.trim();
    if (classItem.batch === 'G1' && grp !== 'Group 1') return false;
    if (classItem.batch === 'G2' && grp !== 'Group 2') return false;
    if (userScope?.groupOption && userScope.groupOption !== grp) return false;
  }

  return true;
}

function isClassCancelledBySuspension(classItem, dateStr, suspension, userScope) {
  if (!suspension.published) return false;
  if (!isDateInRange(dateStr, suspension.startDate, suspension.endDate)) return false;
  if (!doesScopeApply(suspension, classItem, userScope)) return false;

  const classStart = timeToMinutes(classItem.startTime);
  const classEnd = timeToMinutes(classItem.endTime);

  if (suspension.suspensionType === 'full_day') {
    return true;
  }

  if (suspension.suspensionType === 'after_cutoff') {
    if (!suspension.cutoffTime) return false;
    const cutoffMinutes = timeToMinutes(suspension.cutoffTime);
    return classStart >= cutoffMinutes;
  }

  if (suspension.suspensionType === 'period') {
    if (!suspension.cutoffTime || !suspension.periodEndTime) return false;
    const periodStart = timeToMinutes(suspension.cutoffTime);
    const periodEnd = timeToMinutes(suspension.periodEndTime);
    return classStart < periodEnd && classEnd > periodStart;
  }

  return false;
}

function isClassCancelledByEvent(classItem, dateStr, event, userScope) {
  if (!event.published || !event.cancelsClasses) return false;
  if (!isDateInRange(dateStr, event.startDate, event.endDate)) return false;
  if (!doesScopeApply(event, classItem, userScope)) return false;

  if (event.startTime && event.endTime) {
    const classStart = timeToMinutes(classItem.startTime);
    const classEnd = timeToMinutes(classItem.endTime);
    const eventStart = timeToMinutes(event.startTime);
    const eventEnd = timeToMinutes(event.endTime);
    return classStart < eventEnd && classEnd > eventStart;
  }

  return true;
}

// -------------------------------------------------------------
// Test Execution
// -------------------------------------------------------------
let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  FAIL: ${testName}`);
    failed++;
  }
}

console.log('--- Testing Cancellation Logic Scenarios ---');

// Test 1: Full day holiday cancels classes
const holiday = {
  published: true,
  cancelsClasses: true,
  startDate: '2026-10-27',
  endDate: '2026-10-27',
  eventType: 'holiday',
};
const dummyClass = { id: '1', section: 'CSE-15', startTime: '09:40', endTime: '10:30' };
assert(isClassCancelledByEvent(dummyClass, '2026-10-27', holiday), 'Full day holiday cancels class on date');
assert(!isClassCancelledByEvent(dummyClass, '2026-10-28', holiday), 'Holiday does not cancel class on another date');

// Test 2: Training does NOT cancel classes by default
const trainingDefault = {
  published: true,
  cancelsClasses: false,
  startDate: '2026-10-26',
  eventType: 'training',
};
assert(!isClassCancelledByEvent(dummyClass, '2026-10-26', trainingDefault), 'Training does NOT cancel classes when cancelsClasses=false');

// Test 3: Cutoff rule 2:50 PM (14:50)
const cutoffSuspension = {
  published: true,
  startDate: '2026-10-26',
  suspensionType: 'after_cutoff',
  cutoffTime: '14:50',
};
const classBeforeCutoff = { id: 'c1', section: 'CSE-15', startTime: '13:10', endTime: '14:00' };
const classJustBeforeCutoff = { id: 'c2', section: 'CSE-15', startTime: '14:49', endTime: '15:30' };
const classAtExactCutoff = { id: 'c3', section: 'CSE-15', startTime: '14:50', endTime: '15:40' };
const classAfterCutoff = { id: 'c4', section: 'CSE-15', startTime: '15:40', endTime: '16:30' };

assert(!isClassCancelledBySuspension(classBeforeCutoff, '2026-10-26', cutoffSuspension), 'Class at 13:10 is NOT cancelled by 14:50 cutoff');
assert(!isClassCancelledBySuspension(classJustBeforeCutoff, '2026-10-26', cutoffSuspension), 'Class at 14:49 is NOT cancelled by 14:50 cutoff');
assert(isClassCancelledBySuspension(classAtExactCutoff, '2026-10-26', cutoffSuspension), 'Class starting EXACTLY at 14:50 IS cancelled by 14:50 cutoff');
assert(isClassCancelledBySuspension(classAfterCutoff, '2026-10-26', cutoffSuspension), 'Class at 15:40 IS cancelled by 14:50 cutoff');

// Test 4: Period suspension (12:00 to 14:00)
const periodSuspension = {
  published: true,
  startDate: '2026-10-26',
  suspensionType: 'period',
  cutoffTime: '12:00',
  periodEndTime: '14:00',
};
const morningClass = { id: 'p1', section: 'CSE-15', startTime: '09:40', endTime: '10:30' };
const overlappingClass = { id: 'p2', section: 'CSE-15', startTime: '12:10', endTime: '13:00' };
const lateAfternoonClass = { id: 'p3', section: 'CSE-15', startTime: '14:00', endTime: '14:50' };

assert(!isClassCancelledBySuspension(morningClass, '2026-10-26', periodSuspension), 'Class at 09:40-10:30 is NOT cancelled by 12:00-14:00 period');
assert(isClassCancelledBySuspension(overlappingClass, '2026-10-26', periodSuspension), 'Class at 12:10-13:00 IS cancelled by 12:00-14:00 period');
assert(!isClassCancelledBySuspension(lateAfternoonClass, '2026-10-26', periodSuspension), 'Class at 14:00-14:50 is NOT cancelled by 12:00-14:00 period');

// Test 5: Multi-day holiday
const winterBreak = {
  published: true,
  cancelsClasses: true,
  startDate: '2026-12-24',
  endDate: '2027-01-02',
  eventType: 'holiday',
};
assert(!isClassCancelledByEvent(dummyClass, '2026-12-23', winterBreak), 'Before break: NOT cancelled');
assert(isClassCancelledByEvent(dummyClass, '2026-12-24', winterBreak), 'Start of break: CANCELLED');
assert(isClassCancelledByEvent(dummyClass, '2026-12-31', winterBreak), 'Middle of break: CANCELLED');
assert(isClassCancelledByEvent(dummyClass, '2027-01-02', winterBreak), 'End of break: CANCELLED');
assert(!isClassCancelledByEvent(dummyClass, '2027-01-03', winterBreak), 'After break: NOT cancelled');

// Test 6: Scope filtering (Section & Group)
const sectionScopedSuspension = {
  published: true,
  startDate: '2026-10-26',
  suspensionType: 'full_day',
  affectedSection: 'CSE-15',
};
const cse15Class = { id: 's1', section: 'CSE-15', startTime: '10:30', endTime: '11:20' };
const cse14Class = { id: 's2', section: 'CSE-14', startTime: '10:30', endTime: '11:20' };
assert(isClassCancelledBySuspension(cse15Class, '2026-10-26', sectionScopedSuspension, { section: 'CSE-15' }), 'Applies to CSE-15');
assert(!isClassCancelledBySuspension(cse14Class, '2026-10-26', sectionScopedSuspension, { section: 'CSE-14' }), 'Does NOT apply to CSE-14');

console.log(`\nResults: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
