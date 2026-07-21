---
name: FlowDeck mobile navigation
description: How tabs and detail routes are structured in the FlowDeck Expo app; the dual tab-layout gotcha.
---

# FlowDeck mobile navigation

The tab bar is implemented TWICE in `app/(tabs)/_layout.tsx` and both must be kept in sync:
- `NativeTabLayout` — `NativeTabs` from `expo-router/unstable-native-tabs`, used when `isLiquidGlassAvailable()` (iOS 26+ liquid glass). Each tab is a `NativeTabs.Trigger` with an SF Symbol `Icon` (`sf={{default, selected}}`) + `Label`.
- `ClassicTabLayout` — classic `Tabs` fallback for Android/web/older iOS. Each tab is a `Tabs.Screen` with `title` (this is the tab label since `headerShown:false`) and a `tabBarIcon` that renders `SymbolView` on iOS else `Feather`.

**Why:** adding a screen file to `app/(tabs)/` auto-creates a tab, but if you only update one layout the icon/label/order is wrong on the other platform. Any new tab needs an entry in BOTH layouts.

**How to apply:** to add a tab, create `app/(tabs)/<name>.tsx`, then add a matching `NativeTabs.Trigger name="<name>"` AND a `Tabs.Screen name="<name>"` in the same order.

Detail screens live at ROOT stack level (not inside `(tabs)`), following `project/[id]`: create `app/<thing>/[id].tsx`, register `<Stack.Screen name="<thing>/[id]" />` in `app/_layout.tsx`, read the param with `useLocalSearchParams<{id:string}>()`, and back-navigate with `IconButton name="chevron-back"` + `router.back()` passed to `Header`'s `left` prop. This keeps detail pages full-screen over the tab bar.

Auth gating for tabs lives only in `TabLayout` (redirects to `/login` when unauthenticated). Root-level detail routes are NOT auth-gated by that guard, so any future detail screen that fetches private data must guard against unauthenticated direct links itself.
