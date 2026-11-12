# Design system

One theme, built into the code. Every screen (landing, login, app, privacy) is made from the same pieces, so the product looks like one product. The rules are enforced by `npm run check:theme`, which runs in `npm run verify` and fails on violations.

## Where things live

| What | File | Rule |
|---|---|---|
| Colors | `theme/colors.ts` | The only place hex colors may appear. Brand colors are sampled from the logo: aquamarine `#22F0C2` (`accent`) and deep teal `#0A7C72` (`accentDeep`); dark neutrals are tinted toward that teal. |
| Typography | `theme/typography.ts` | One typeface (Inter, 4 weights) and a named scale (`display`, `hero`, `h1`…`caption`, `button`, `nav`). Render text only with `<Text variant="...">`. |
| Spacing, radius, hit targets | `theme/spacing.ts` | 4-pt scale (`space.xs`…`giant`), `radius.*`, `hit.*` (44 px minimum touch target). |
| Layout | `theme/layout.ts` | Breakpoints (`compact` < 720, `medium` < 1100, `expanded` >= 1100), content max width, gutters, nav sizes, `useSize()`. |
| Icons | `theme/icons.ts` | One stroke icon set on a 24 px grid, drawn by `<Icon name="…" />`. Add icons here; never add another icon library. |
| Components | `components/ui/` | `Text`, `Icon`, `Screen`, `Stack`, `Inline`, `Grid`, `Card`, `Badge`, `Button`, `Chip`, `SegTabs`, `Field`, `Select`, `Slider`, `Gauge`, `Ring`, `Chart`, `Sheet`, `Band`. Build screens from these. |

## Color meaning (fixed app-wide)

* **accent (mint)**: progress, savings, the primary action
* **amber**: interest and caution
* **risk (red)**: a limit exceeded, destructive actions
* Everything else is neutral (`text`, `textMuted`, `card`, `surface`, `border`).

## Layout rules

* One responsive layout for phone, tablet and desktop web: phones get a bottom tab bar, wide screens get a left sidebar. Content is centered and capped at `layout.content.max`; never stretch it edge to edge.
* Use `<Screen>` for every page body and `<Grid>` for side-by-side cards: columns wrap to a single column on narrow screens.
* Money and numbers use tabular figures (`hero`, `stat` variants) so columns line up.
* Touch targets are at least 44 px; text contrast is at least 4.5:1 (`textMuted` is 6.5:1 on `card`).

## What `npm run check:theme` rejects

* Hex / `rgb()` / `hsl()` colors outside `theme/`
* `fontFamily` / `fontSize` / `fontWeight` outside `theme/`
* `Text` or `TextInput` imported from `react-native` outside `components/ui/`
* Other icon libraries
* Raw numeric `padding` / `margin` / `gap` / `borderRadius` in screens and shared components (use `space.*` / `radius.*`)

## Adding a screen

1. Create `screens/FooScreen.tsx` from `components/ui` primitives.
2. Add a one-line route file under `app/` (`export { default } from '../../screens/FooScreen'`).
3. Run `npm run verify`.
