
import { useState, useMemo } from 'react';

export type Region = {
    id: string;
    name: string;
    branches24h: number; // 3 shifts
    branchesRegular: number; // 2 shifts
};

export const useStaffingCalculator = (initialRegions: Region[]) => {
    const [regions, setRegions] = useState<Region[]>(initialRegions);
    const [includePublicHolidays, setIncludePublicHolidays] = useState(false);
    const [includeRamadan, setIncludeRamadan] = useState(false);
    const [includeAnnualLeave, setIncludeAnnualLeave] = useState(false);
    const [currentStaff, setCurrentStaff] = useState<number>(0);
    const [leaveCycleMonths, setLeaveCycleMonths] = useState<number>(12); // Default 12 months
    const [ramadanConfig, setRamadanConfig] = useState({
        totalFemaleHours: 1000, // Total accumulated hours for all female staff
        totalMaleHours: 1000,   // Total accumulated hours for all male staff
        maleDayValuation: 8,  // 8 hours = 1 day for males
        femaleDayValuation: 6 // 6 hours = 1 day for females
    });

    // Constants
    const DAYS_IN_YEAR = 365;
    const LEAVES_WEEKLY = 52; // 1 day per week for 52 weeks
    const LEAVES_ANNUAL = 30;
    const LEAVES_PUBLIC_HOLIDAYS = 14;

    const results = useMemo(() => {
        // 1. Scale Timeframe and Leaves based on Cycle
        const cycleRatio = leaveCycleMonths / 12;
        const cycleDays = DAYS_IN_YEAR * cycleRatio;
        const cycleWeeklyLeaves = 52 * cycleRatio; // 1 per week
        const cyclePublicHolidays = LEAVES_PUBLIC_HOLIDAYS * cycleRatio;

        // Annual Leave (30 days) is what's being distributed over this cycle
        const totalLeavesInCycle = cycleWeeklyLeaves +
            (includePublicHolidays ? cyclePublicHolidays : 0) +
            (includeAnnualLeave ? LEAVES_ANNUAL : 0);

        const workingDaysInCycle = cycleDays - totalLeavesInCycle;

        // 2. Calculate Total Demand for the Cycle
        let totalDailyShifts = 0;
        regions.forEach(region => {
            const shifts24h = region.branches24h * 3;
            const shiftsRegular = region.branchesRegular * 2;
            totalDailyShifts += (shifts24h + shiftsRegular);
        });

        const totalShiftsInCycle = totalDailyShifts * cycleDays;

        // 3. Headcount Calculation
        // Required = Total Work needed / What one person can contribute
        const pharmacistsNeededRaw = totalShiftsInCycle / workingDaysInCycle;
        const basePharmacistsNeeded = Math.ceil(pharmacistsNeededRaw);

        // 6. Ramadan Analysis (kept on annual basis or scaled? Better to scale to cycle)
        // Convert Ramadan impact to the cycle timeframe
        const femaleTotalHours = ramadanConfig.totalFemaleHours || 0;
        const maleTotalHours = ramadanConfig.totalMaleHours || 0;
        const totalRamadanHours = femaleTotalHours + maleTotalHours;

        const femaleValuation = ramadanConfig.femaleDayValuation || 6;
        const maleValuation = ramadanConfig.maleDayValuation || 8;

        const femaleDaysOff = femaleTotalHours / femaleValuation;
        const maleDaysOff = maleTotalHours / maleValuation;

        const ramadanEquivalentShiftsInCycle = femaleDaysOff + maleDaysOff;
        const ramadanCoverageFTE = ramadanEquivalentShiftsInCycle / workingDaysInCycle;

        const finalTotalPharmacistsNeeded = includeRamadan
            ? Math.ceil(pharmacistsNeededRaw + ramadanCoverageFTE)
            : basePharmacistsNeeded;

        // Relief Force = Total Headcount - Base Daily Staffing
        const reliefForceSize = finalTotalPharmacistsNeeded - totalDailyShifts;

        // Coverage Ratio
        const coverageRatio = totalDailyShifts > 0 ? (finalTotalPharmacistsNeeded / totalDailyShifts) : 0;

        // 7. Gap Analysis & Strategy
        const staffingGap = finalTotalPharmacistsNeeded - currentStaff;
        const availableRelief = Math.max(0, currentStaff - totalDailyShifts);
        const reliefCoverageRatio = reliefForceSize > 0 ? (availableRelief / reliefForceSize) : 1;

        // Strategy: If we have less staff than needed, we must stretch the 12-month leave cycle
        // Example: If ratio is 0.5, a 12-month cycle becomes 24 months
        const recommendedCycleMonths = staffingGap > 0
            ? Math.ceil(12 * (finalTotalPharmacistsNeeded / Math.max(1, currentStaff)))
            : 12;

        return {
            totalDailyShifts,
            totalPharmacistsNeeded: finalTotalPharmacistsNeeded,
            basePharmacistsNeeded,
            reliefForceSize,
            coverageRatio,
            workingDaysInCycle,
            currentStaff,
            leaveCycleMonths,
            staffingGap,
            strategy: {
                recommendedCycleMonths,
                availableRelief,
                reliefCoverageRatio,
                isUnderstaffed: staffingGap > 0,
                isCriticallyUnderstaffed: currentStaff < totalDailyShifts
            },
            ramadan: {
                totalHours: totalRamadanHours,
                equivalentShifts: ramadanEquivalentShiftsInCycle,
                coverageFTE: ramadanCoverageFTE,
                breakdown: {
                    femaleDaysOff,
                    maleDaysOff
                },
                isActive: includeRamadan
            }
        };
    }, [regions, includePublicHolidays, includeRamadan, includeAnnualLeave, ramadanConfig, currentStaff, leaveCycleMonths]);

    const updateRegion = (id: string, field: 'branches24h' | 'branchesRegular', value: number) => {
        setRegions(prev => prev.map(r =>
            r.id === id ? { ...r, [field]: Math.max(0, value) } : r
        ));
    };

    return {
        regions,
        setRegions,
        updateRegion,
        includePublicHolidays,
        setIncludePublicHolidays,
        includeRamadan,
        setIncludeRamadan,
        includeAnnualLeave,
        setIncludeAnnualLeave,
        currentStaff,
        setCurrentStaff,
        leaveCycleMonths,
        setLeaveCycleMonths,
        ramadanConfig,
        setRamadanConfig,
        results
    };
};
