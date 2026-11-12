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
npm run sandbox        # your private cloud backend (see docs/SANDBOX.md)
npm run dev:sandbox    # the app against that sandbox
```

Guest and sample modes work with no backend at all (they only need an `amplify_outputs.json` file to exist for the build).

See **docs/SANDBOX.md** for how to test auth, the database and Plaid without touching the live app.

## Build for production

```bash
npm run build
```

## Technology stack

React 19, TypeScript, Vite, Tailwind 4, Recharts, React Router, AWS Amplify Gen 2 (Cognito, AppSync/DynamoDB, Lambda) and Plaid.
