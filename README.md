# Modulos - Personal Finance & Debt Payoff Planner

A web application to help you manage your finances and create a debt payoff plan using the avalanche method.

## Features

- **Income Management**: Track net or gross income with automatic tax calculations
- **Expense Tracking**: Manage monthly expenses with standard categories
- **Loan Management**: Add and track multiple loans (Credit Card, Mortgage, Auto, Student, Other)
- **Loan Affordability Check**: See if you can afford a new loan based on DTI ratio
- **Debt Payoff Plan**: Visualize your path to being debt-free with charts
- **Risk Profile Settings**: Customize DTI thresholds based on your risk tolerance

## What's in the app

- **Overview**: debt-free date with progress ring and total paid so far, a **next best action**, minimums / DTI / leftover (DTI always uses gross income, estimated from take-home pay when gross isn't entered), balance history + projection with a rounded balance axis, two short "faster payoff" insights, net worth.
- **Debts**: every debt with Active / Considering / Paid off, loan-type presets, import from bank, property tax on mortgages, and **Test a new loan** (name, type, optional lender payment, risk profile with percentages, DTI now vs after, total debt before and after, a 10% pay-cut stress test, negative-amortization warning, "what would make this safer?").
- **Plan**: Avalanche, Snowball or Custom; extra payment with **+/- stepper, slider, typed amount and "use all available"**, always capped at the money available for debt payoff with a warning when little cushion remains; minimum + extra (or by-debt) breakdown; before/after chart with $ axis and month checkpoints; a **payoff checklist** (paid-off debts crossed out); **aim-for-a-date** month slider limited to what is reachable; one **What if** (new loan or refinance).
- **Budget** (Summary / Income / Expenses): where your money goes, income vs expenses by month (bank only), the full **tax calculator** or plain take-home pay, one list of **all expenses** by category with add/edit, and recent **bank transactions** (bank only).
- **Assets**: net worth, a "what you own" visualization, retirement performance over time (bank-linked accounts only), and your asset list.
- **Progress**: log payments or have your bank detect them, **plan vs actual** by month (bank only), and milestones with a "next up" card.
- **Profile**: account, risk profile, linked accounts, clear sample data, data and privacy, about.
- **Onboarding**: connect a bank or enter income and a first debt; guest and sample profiles are supported.

## Run it

```bash
npm install
npm run dev:offline    # web, guest + sample mode, no cloud needed
```

With a cloud backend (auth, database, Plaid), see **docs/SANDBOX.md**:

```bash
npm run sandbox        # your private cloud backend
npm run dev:sandbox    # the app against it, with a SANDBOX badge
```

On a phone or simulator: `npm run ios` / `npm run android` (Expo). Bank linking on a device needs a development build because the Plaid SDK is native.

## Checks

```bash
npm run verify         # typecheck + design-system check + unit tests
```

## Build for production (web)

```bash
npm run build          # outputs dist/ (Expo web export)
```

## Technology stack

Expo + React Native (one codebase for web, iOS and Android), Expo Router, TypeScript, react-native-svg charts, AWS Amplify Gen 2 (Cognito, AppSync/DynamoDB, Lambda) and Plaid. The design system is in `theme/` and `components/ui/` (see **docs/DESIGN.md**).

## Project layout

```
app/          routes (thin files that re-export screens) + web document shell
screens/      one file per screen
components/   shared pieces; components/ui is the design-system primitives
theme/        colors, typography, spacing, layout, icons
services/     pure logic: payoff, loan test, payments, tax, Plaid merge
contexts/     auth and finance state
hooks/        usePlan, useBanks, useAmplifyStorage, ...
lib/          storage, Amplify client, Plaid launcher (web/native), dialogs
amplify/      backend: auth, data, Plaid Lambda
tests/        unit tests for services and bank-payment matching
```
