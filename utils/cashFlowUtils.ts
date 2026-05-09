import { Cheque, Expense, ActualRevenue, ExpectedRevenue, ForecastDay, CashFlowSettings, RiskLevel, Supplier } from '../types';

export const calculateForecast = (
    settings: CashFlowSettings,
    cheques: Cheque[],
    expenses: Expense[],
    actualRevenues: ActualRevenue[],
    expectedRevenues: ExpectedRevenue[]
): ForecastDay[] => {
    const forecast: ForecastDay[] = [];
    const horizon = settings.forecastHorizon || 30;
    let currentBalance = settings.initialBalance || 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < horizon; i++) {
        const currentDate = new Date(today);
        currentDate.setDate(today.getDate() + i);
        const dateStr = currentDate.toISOString().split('T')[0];

        const openingBalance = currentBalance;
        let morningInflow = 0;
        let morningOutflow = 0;
        let afternoonInflow = 0;
        let afternoonOutflow = 0;
        const items: ForecastDay['items'] = [];

        // 1. Filter items for this day
        const dailyActual = actualRevenues.filter(r => r.revenueDate === dateStr);
        const dailyExpected = expectedRevenues.filter(r => r.expectedDate === dateStr);
        const dailyCheques = cheques.filter(c => c.dueDate === dateStr && c.status !== 'Paid');
        const dailyExpenses = expenses.filter(e => e.expenseDate === dateStr);

        // 2. Morning Bucket (Before 10:00 AM)
        dailyActual.filter(r => (r.settlementTime || '08:00') < '10:00').forEach(r => {
            morningInflow += r.amount;
            items.push({ type: 'revenue_actual', name: `Morning Cash (${r.paymentType})`, amount: r.amount, id: r.id, ref: r });
        });

        dailyCheques.filter(c => (c.executionTime || '09:00') <= '10:00').forEach(c => {
            morningOutflow += c.amount;
            items.push({ type: 'cheque', name: `Cheque #${c.chequeNumber}`, amount: c.amount, priority: c.priority, id: c.id, ref: c });
        });

        dailyExpenses.forEach(e => {
            // Assume expenses are morning priority unless specified
            morningOutflow += e.amount;
            items.push({ type: 'expense', name: e.category, amount: e.amount, priority: e.priority, id: e.id, ref: e });
        });

        const morningBalance = openingBalance + morningInflow - morningOutflow;

        // 3. Afternoon Bucket (After 01:00 PM)
        dailyActual.filter(r => (r.settlementTime || '13:00') >= '10:00').forEach(r => {
            afternoonInflow += r.amount;
            items.push({ type: 'revenue_actual', name: `${r.paymentType} Settlement`, amount: r.amount, id: r.id, ref: r });
        });

        if (dailyActual.length === 0) {
            dailyExpected.forEach(r => {
                afternoonInflow += r.expectedAmount;
                items.push({ type: 'revenue_expected', name: `Forecasted: ${r.reason || 'Sales'}`, amount: r.expectedAmount, id: r.id, ref: r });
            });
        }

        const closingBalance = morningBalance + afternoonInflow - afternoonOutflow;

        const getRiskLevel = (bal: number): RiskLevel => {
            if (bal < 0) return 'Critical';
            if (bal < settings.safeThreshold) return 'Warning';
            return 'Safe';
        };

        forecast.push({
            date: dateStr,
            openingBalance,
            inflow: morningInflow + afternoonInflow,
            outflow: morningOutflow + afternoonOutflow,
            morningBalance,
            afternoonBalance: closingBalance,
            closingBalance,
            morningRisk: getRiskLevel(morningBalance),
            riskLevel: getRiskLevel(closingBalance),
            items
        });

        currentBalance = closingBalance;
    }

    return forecast;
};

export const getSmartSuggestions = (forecast: ForecastDay[], suppliers: Supplier[]) => {
    const suggestions: {
        date: string;
        type: 'delay_cheque' | 'delay_expense' | 'move_to_afternoon';
        item: any;
        impact: number;
        reason: string;
        riskLevel: 'Low' | 'Medium' | 'High';
    }[] = [];

    forecast.forEach(day => {
        // Danger happens in the morning! (Requirement 1 & 2)
        if (day.morningRisk === 'Critical' || day.morningBalance < 0) {
            const gap = Math.abs(day.morningBalance);

            // 1. Suggest delaying morning cheques
            const morningCheques = day.items
                .filter(it => it.type === 'cheque')
                .map(it => {
                    const supplier = suppliers.find(s => s.id === it.ref.supplierId);
                    return { ...it, supplier };
                });

            // Priority 1: Flexible priority + Flexible supplier
            const highFlexCheques = morningCheques.filter(c =>
                c.priority === 'Flexible' || (c.supplier?.flexibilityLevel === 'High')
            ).sort((a, b) => b.amount - a.amount);

            highFlexCheques.forEach(it => {
                suggestions.push({
                    date: day.date,
                    type: 'delay_cheque',
                    item: it.ref,
                    impact: it.amount,
                    reason: `Critical morning deficit detected. Delaying ${it.name} (${it.supplier?.name || 'Supplier'}) is recommended due to flexibility status.`,
                    riskLevel: 'Low'
                });
            });

            // 2. Move cheque to afternoon if afternoon balance is healthy (After Visa)
            if (day.afternoonBalance > gap) {
                const normalCheques = morningCheques.filter(c => c.priority === 'Normal');
                normalCheques.forEach(it => {
                    suggestions.push({
                        date: day.date,
                        type: 'move_to_afternoon',
                        item: it.ref,
                        impact: it.amount,
                        reason: `Liquidity arrives at 1:00 PM (Visa). Reschedule ${it.name} to afternoon to avoid morning risk.`,
                        riskLevel: 'Medium'
                    });
                });
            }

            // 3. Delay morning expenses (Variable, Delay allowed)
            const delayableExpenses = day.items
                .filter(it => it.type === 'expense' && it.ref.delayAllowed && it.ref.type === 'Variable')
                .sort((a, b) => b.amount - a.amount);

            delayableExpenses.forEach(it => {
                suggestions.push({
                    date: day.date,
                    type: 'delay_expense',
                    item: it.ref,
                    impact: it.amount,
                    reason: `${it.name} is a variable morning expense. Postponing this will alleviate morning pressure.`,
                    riskLevel: 'Medium'
                });
            });
        }
    });

    return suggestions;
};
