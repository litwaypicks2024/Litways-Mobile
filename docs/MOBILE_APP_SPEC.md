# LitwaysPicks — Mobile App Specification

**Prepared for:** Client review
**Product:** LitwaysPicks mobile shopping app ("Shop Smarter. Shop Local.")
**Positioning:** Liberia's #1 fashion & lifestyle store
**Platforms:** iOS (iPhone + iPad) and Android
**Date:** July 2026

---

## 1. Overview

This document describes everything the mobile version of LitwaysPicks includes. The app is a full native shopping experience — customers can discover products, search and filter the catalog, manage a cart and wishlist, create an account, check out, pay via MTN Mobile Money, and track their orders — all from their phone.

The app shares the same backend and product catalog as the LitwaysPicks website, so inventory, pricing, orders, and customer accounts stay in sync across web and mobile.

---

## 2. Platform & Delivery

| Item | Detail |
|------|--------|
| **iOS** | iPhone and iPad (tablet layout supported), delivered to the Apple App Store |
| **Android** | Phones and tablets, delivered to Google Play |
| **App name** | LitwaysPicks |
| **Brand color** | Orange (`#ea580c`) with a clean, light interface |
| **Orientation** | Portrait |
| **Deep links** | Opens directly to products via `litwaypicks://` links and shared web links |
| **Offline resilience** | Cart and wishlist are saved on the device and survive app restarts and loss of connection |

---

## 3. Core Shopping Experience

### 3.1 Home
The landing screen designed to drive discovery and conversion:
- **Promotional banner carousel** — swipeable, full-width promo banners (flash deals, free delivery, new arrivals) with page indicators.
- **Shop by Category** — horizontally scrolling category tiles with images/icons.
- **Today's Deals** — products currently on sale, marked with a "HOT" badge.
- **Featured Picks** — merchandiser-selected featured products.
- **New Arrivals** — the latest products added to the catalog.
- **Trust strip** — reassurance badges: Free Delivery (all 15 counties), Secure Pay (MTN MoMo), 7-Day Returns.
- **Quick access** to search and cart from the header, with a live cart-count badge.
- **Pull-to-refresh** to reload the latest content.

### 3.2 Shop & Search
A dedicated catalog browsing screen:
- **Live search** across product names and brands, with results appearing as the customer types.
- **Recent searches** saved on the device for quick re-use.
- **Sorting**: Featured, Price (low→high), Price (high→low), Newest, Top Rated.
- **Filters**: by brand, by size, and by price range.
- **Active filter chips** with one-tap removal and a "Clear all" option.
- **Result count** ("X products" / "X results for …").
- **Infinite scroll** — more products load automatically as the customer scrolls.
- **Empty state** guidance when nothing matches.

### 3.3 Category Browsing
Tapping any category opens a focused, paginated grid of every product in that category.

### 3.4 Product Detail
A rich, conversion-focused product page:
- **Image gallery** — swipeable full-screen images with a thumbnail strip and page dots; smooth animated transition from the product grid.
- **Pricing** — current price, original price with strike-through, discount percentage, and "You save" amount when on sale.
- **Ratings & reviews** — average star rating, review count, and a list of customer reviews.
- **Size and color selection** (when applicable) with required-selection validation before adding to cart.
- **Stock indicators** — "Out of Stock" and low-stock urgency ("Only X left!").
- **Expandable description** ("Read more / Show less").
- **Delivery reassurance card** — free nationwide delivery, buyer protection, easy returns.
- **Add to Cart** with instant confirmation feedback.
- **Wishlist toggle** and **native share** (share product to any app / messaging).

---

## 4. Cart & Wishlist

### 4.1 Cart
- Add items with selected size/color; quantities merge intelligently for identical items.
- **Adjust quantity** or **remove** items; **clear entire cart** with confirmation.
- **Live subtotal** and item count.
- **Free-shipping progress bar** — shows how much more is needed to reach the free-shipping threshold ($50).
- **Cross-device sync** — for signed-in customers the cart is saved to their account, so it follows them across devices and sessions.
- Guests are prompted to sign in when they proceed to checkout.

### 4.2 Wishlist
- Save products from the product page, wishlist tab, or catalog.
- Persists on the device across sessions.
- **Add to cart directly** from the wishlist.
- Wishlist count badge on the tab bar.

---

## 5. Checkout & Payment

A streamlined **two-step checkout**:

**Step 1 — Delivery**
- Contact details (name, email, phone) — pre-filled from the customer's profile when signed in.
- Delivery address with a **county picker for all 15 Liberian counties**.
- Field validation and a "Free delivery across all 15 Liberian counties" note.

**Step 2 — Payment**
- Order summary with itemized products, quantities, and total.
- Editable delivery summary.
- **MTN Mobile Money (MoMo) payment** — a USSD prompt is sent to the customer's phone to approve.
- **Real-time confirmation** — the app listens for payment confirmation live and updates automatically; no manual refresh needed.
- Clear states for "Awaiting MoMo," success, failure, and a 5-minute timeout safeguard.

**Order Confirmation**
- A success screen with order ID, status, total, delivery details, and itemized list.
- Confirmation email is sent to the customer.
- Cart is cleared automatically on success.

---

## 6. Accounts & Authentication

- **Email/password sign-up and sign-in** in a single, polished screen.
- **Biometric sign-in** — Face ID / Touch ID / fingerprint for fast, secure returning-user access.
- **Password reset** via email.
- **Guest browsing** — customers can browse, search, and build a cart without an account; sign-in is only required at checkout.
- Terms of Service and Privacy Policy acknowledgment on sign-up.

### Account Area (4 tabs)
- **Profile** — view and edit name, phone, address, and city.
- **Orders** — full order history with status badges, totals, and item previews; tap any order for full details.
- **Wishlist** — saved items in one place.
- **Settings** — change password, sign out.
- **Write a review** — customers can rate and review products from their completed orders.

### Order Details
A dedicated screen per order showing status, order/delivery info, itemized products (each tappable back to the product page), and total.

---

## 7. Notifications
- **Push notifications** for order updates, delivered through a dedicated "Order Updates" channel (Android) with brand styling.
- Permission is requested appropriately, and notifications deep-link back into the app.

---

## 8. Informational Pages
Built-in content pages accessible in-app:
- About
- Contact (with a working message/enquiry form)
- Shipping information
- Returns policy
- Terms & Conditions
- Privacy Policy

---

## 9. Experience & Quality Details
These are the "feel" details that make the app polished:
- **Haptic feedback** on key interactions.
- **Skeleton loaders** while content loads (no blank screens).
- **Smooth image loading** with blurred placeholders.
- **Friendly empty states** throughout (empty cart, no results, no orders, etc.).
- **Graceful error handling** so a single failure never crashes the app.
- **Consistent design system** — shared buttons, inputs, badges, and cards across every screen.
- **Safe-area aware** layouts that respect notches, home indicators, and status bars.

---

## 10. Technical Foundation
*(For reference — no action needed from the client.)*

| Area | Technology |
|------|-----------|
| Framework | Expo SDK 56 / React Native (native iOS & Android) |
| Navigation | File-based routing with typed links |
| Backend | Supabase (accounts, catalog, orders, reviews, real-time updates) |
| Payments | MTN Mobile Money via the LitwaysPicks payment API |
| Data & caching | React Query for fast, cached data loading |
| Local storage | On-device persistence for cart, wishlist, and recent searches |
| Styling | Tailwind-based design system |
| Language | TypeScript (type-safe throughout) |
| Currency | All prices displayed in **US Dollars ($)** |

---

## 11. Notes & Items to Confirm
A few points worth aligning on before launch:

1. **Free-shipping threshold** — set to **$50 (USD)**; confirm the intended value.
2. **Home banners** — the promotional banners are currently fixed in the app. If you want to update them without an app release, a small admin/CMS hook can be added.
3. **Payment methods** — MTN Mobile Money is the supported method today. Additional methods (card, other mobile-money providers) can be scoped separately.
4. **Push notifications** — require the production build to be fully wired to the order system for automated order-status alerts; confirm the trigger events you want customers notified about.
5. **App Store assets** — final app icons, splash screen, screenshots, and store listing copy will be needed for submission.

---

*This document reflects the mobile app as currently built. Feature scope can be adjusted — additions or changes can be estimated on request.*
