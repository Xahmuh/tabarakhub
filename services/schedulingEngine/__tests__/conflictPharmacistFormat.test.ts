import { generateSchedule } from '../index';

function testConflictPharmacistFormat() {
  console.log('=== Testing Pharmacist Name & Code in Conflicts ===\n');

  const employees = [
    { id: 'f2ff6a08-34e9-442b-8f2c-9e4c8236e864', code: 'E001', full_name: 'Dr. Sarah Ahmed', category: 'Pharmacist' },
    { id: 'a2870a1f-c359-46aa-b4af-d9db8f85bef8', code: 'E002', full_name: 'Mohamed Ibrahim', category: 'Pharmacist' }
  ];

  // Test regex parser replacement logic
  const empMap = new Map<string, string>();
  employees.forEach(emp => {
    const clean = emp.full_name.replace(/^dr[\.\s]+/i, '').trim().toUpperCase();
    const codePart = emp.code ? ` (${emp.code})` : '';
    empMap.set(emp.id.toLowerCase(), `DR. ${clean}${codePart}`);
  });

  const rawDescription = "Weekend distribution preference deviation: Pharmacist f2ff6a08-34e9-442b-8f2c-9e4c8236e864 assigned to weekend shift (PM) to maintain zero-gap coverage (preferred weekend pool was unavailable or constrained).";

  const uuidRegex = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;
  const replaced = rawDescription.replace(uuidRegex, (match) => {
    return empMap.get(match.toLowerCase()) || match;
  });

  console.log('Original: ' + rawDescription);
  console.log('\nFormatted: ' + replaced);

  if (replaced.includes('f2ff6a08-34e9-442b-8f2c-9e4c8236e864')) {
    throw new Error('UUID still found in formatted description!');
  }

  if (!replaced.includes('DR. SARAH AHMED (E001)')) {
    throw new Error('Expected DR. SARAH AHMED (E001) not found in formatted description!');
  }

  console.log('\n  [PASS] UUID was successfully replaced by DR. SARAH AHMED (E001)');

  // Test generateSchedule when passing employees
  const output = generateSchedule({
    scheduleId: 'sched-test',
    startDate: '2026-09-01',
    endDate: '2026-09-07',
    profiles: [
      {
        id: 'prof-1',
        employeeId: 'f2ff6a08-34e9-442b-8f2c-9e4c8236e864',
        roleType: 'FIXED',
        primaryBranchId: 'b-1',
        workRestMode: 'VARIABLE_CYCLE',
        workRestConfig: {},
        patternStrictness: 'HARD',
        maximumConsecutiveWorkingDays: 6,
        minimumRestHours: 11,
        isActive: true,
        createdAt: '',
        updatedAt: ''
      }
    ],
    leaves: [],
    branches: [
      { id: 'b-1', code: 'B01', name: 'Branch 1', isActive: true, crNumber: '', address: '', phone: '', email: '' } as any
    ],
    shiftRequirements: [
      { id: 'sr-1', branchId: 'b-1', code: 'AM', name: 'AM Shift', startTime: '08:00:00', endTime: '16:00:00', staffRequired: 1 }
    ],
    periodAdjustments: {
      weekendPharmacistIds: ['f2ff6a08-34e9-442b-8f2c-9e4c8236e864']
    },
    employees
  });

  console.log(`\nGenerated ${output.conflicts.length} conflicts.`);
  output.conflicts.forEach(c => {
    console.log(`- [${c.severity}] ${c.description}`);
    if (c.description.includes('f2ff6a08-34e9-442b-8f2c-9e4c8236e864')) {
      throw new Error(`Found raw UUID in conflict: ${c.description}`);
    }
  });

  console.log('\n=== All Conflict Pharmacist Format Tests Passed! ===\n');
}

testConflictPharmacistFormat();
