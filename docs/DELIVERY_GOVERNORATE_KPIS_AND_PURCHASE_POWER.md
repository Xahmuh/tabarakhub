# Delivery Governorate KPIs And Purchase Power Proxy

Current status: `B) dedicated-client staging-ready only`

## Purpose

Delivery Coverage now includes a governorate KPI layer for internal delivery
performance review in Bahrain.

It answers:

- Which governorates receive the most delivery orders?
- Which governorates generate the highest recorded delivery value?
- Which branches serve each governorate?
- What share of a branch's delivery work/value goes to each governorate?
- What share of a governorate's delivery work/value comes from each branch?

## Data Sources

The analytics use only existing RLS-scoped delivery data:

- `public.delivery_orders`
- `public.delivery_blocks`
- `public.branches`

Fields used:

- `delivery_orders.branch_id`
- `delivery_orders.block_number`
- `delivery_orders.governorate`
- `delivery_orders.value_bhd`
- `delivery_orders.order_date`
- `delivery_orders.payment_type`
- `delivery_blocks.block_number`
- `delivery_blocks.governorate`

The Bahrain GeoJSON currently contains `BLOCK_NO` only. It does not contain a
governorate property, so governorate mapping comes from `delivery_orders`
snapshots and the `delivery_blocks` directory. No block-to-governorate map is
invented in code.

## Branch Performance Per Governorate

For each branch and governorate combination, the app calculates:

- orders
- total value
- average order value
- served blocks
- share of branch delivery orders
- share of governorate delivery orders
- share of branch delivery value
- share of governorate delivery value

Rows are based only on orders with a known governorate.

## Governorate Performance KPIs

For each governorate, the app calculates:

- total orders
- total value
- average order value
- served blocks
- value per served block
- orders per served block
- Purchase Power Proxy score and band when value data exists

Orders without governorate mapping are not guessed. They are counted in data
quality indicators.

## Purchase Power Proxy

Label used in the UI:

```text
Purchase Power Proxy
```

This is not official economic purchasing power. It is an internal relative demand
index based only on recorded delivery orders and order value.

Calculation when value data exists:

```text
score =
  normalized total value * 50%
  + normalized average order value * 30%
  + normalized orders count * 20%
```

The score is relative to the governorates visible in the current RLS/date/branch
scope. It is not comparable to external market data.

Banding:

- High: top third of scored governorates
- Medium: middle third
- Low: bottom third
- Unavailable: missing or insufficient value data

## Data Quality Indicators

The UI shows:

- total orders analyzed
- orders with mapped governorate
- orders with unmapped governorate
- orders with value
- orders missing value
- blocks with governorate mapping
- blocks without governorate mapping

If value coverage is incomplete, the UI warns:

```text
Value-based KPIs may be incomplete because some orders do not have order value.
```

## Map Integration

Selecting a governorate in the Governorate KPIs tab keeps that governorate
selected in Delivery Coverage state. When the Bahrain block map is open, served
blocks in the selected governorate remain highlighted while other served blocks
are visually de-emphasized.

The branch performance table is filtered to the selected governorate and the UI
shows the top serving branches for that governorate.

## Limitations

- No population data is used.
- No income data is used.
- No customer repeat rate is used.
- No route-time or SLA timing is used.
- No product category or margin data is used.
- Talabat/no-block orders do not contribute to governorate rankings unless a
  real governorate is present.
- Unmapped governorate orders are reported but not assigned.

## Future Enhancements

- Population per governorate.
- Household/income or market-size data from an approved source.
- Route-time data.
- Customer repeat rate.
- Product category demand.
- Margin/profit analytics.
- Delivery SLA timing and status fields.

## Production Boundary

This feature is staging-ready only. It must be validated with real authenticated
manager/owner/supervisor/warehouse/branch sessions before any production claim.

Final status remains:

```text
B) dedicated-client staging-ready only
```
