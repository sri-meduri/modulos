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

- **Overview**: debt-free date, progress ring, minimums / DTI / leftover, balance-over-time chart, an insight, net worth.
- **Debts**: every debt with Active / Considering / Paid off, loan-type presets, import from bank, and **Test a new loan** (Safe / Borderline / Not Recommended, DTI gauge before and after, impact on leftover and debt-free date, "what would make this safer?").
- **Plan**: Avalanche, Snowball or Custom order, an extra-payment slider with quick picks, before/after chart, payoff order, target date, and what-ifs (considering loans, refinance).
- **Budget**: take-home pay, one fixed-expenses number, optional category breakdown, assets.
- **Progress**: log payments, bank-detected payments, milestones, balance history.
- **Profile**: account, linked accounts (connect, reconnect, disconnect and delete imported data), data and privacy.
- **Onboarding**: connect a bank or enter income and a first debt; guests and the sample profile are supported.

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
