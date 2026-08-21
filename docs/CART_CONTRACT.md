# Cart item wire contract (v1)

This is the shape both apps — this mobile app and litwaypicks.com — read and
write for one row of `carts.items` (`carts` is `{ user_id, items: jsonb[] }`,
shared between the two). It's the mobile copy of the web repo's identical
doc; the two must be kept in sync by hand since they live in separate repos.

## The shape

```ts
{
  id: string;
  slug: string;
  name: string;
  brand: string;
  price: number;          // LIST price
  sale_price: number | null; // effective price = sale_price ?? price
  stock: number;
  quantity: number;
  cartKey: string;         // [id, selectedSize, selectedColor].filter(Boolean).join('::') || id
  selectedSize: string | null;
  selectedColor: string | null;
  images: string[];        // UI uses images[0]
}
```

Twelve fields. **Nothing else is persisted.** No `productId`, no `imageUrl`,
no `image_urls`, no free-riding metadata (category, sizes, colors, …) copied
along for the ride — if a field isn't in the list above, a conforming writer
does not put it on the wire.

## The rules

- **`price` is always the LIST price**, `sale_price` is `null` when the item
  isn't discounted. The **effective price** — the number every subtotal,
  line total, and checkout total is computed from — is always
  `sale_price ?? price`. Both apps use this exact rule, so they always agree
  on what a shopper is charged, even for odd data.
- **`cartKey`** is the merge/identity key for one cart line: same product,
  different size or color, is a different line. It's always derivable from
  the row itself — `[id, selectedSize, selectedColor].filter(Boolean).join('::')
  || id` — so a reader never has to trust a stored `cartKey` it can't
  reproduce.
- **`selectedSize`/`selectedColor`** are `null`, not omitted, when the item
  has no size/color. Never `undefined`, never absent.
- **`images`** is an array; a reader displays `images[0]`. A writer that only
  has one image still writes a one-element array, not a bare string.

## Tolerant reading, no data migration

Readers on both sides stay tolerant of **older, non-canonical rows already
sitting in the database** — there is no backfill/migration step that
rewrites existing `carts` rows to the canonical shape. Instead, every reader
normalizes whatever it finds:

- A **canonical v1 row** (this doc) parses directly: effective price is
  `sale_price ?? price`.
- A **legacy mobile row** (pre-contract, identified by the presence of a
  mobile-only `productId` field) already carries the *effective* price in
  `price` and has no `sale_price` of its own.
- A **legacy web row** (pre-`cartKey` web writes) is the canonical fields
  minus `cartKey`/`selectedSize`/`selectedColor`.

Once normalized into whatever the app's own in-memory cart item type is, the
three shapes are indistinguishable to the rest of the app. See this app's
`store/cart.ts` — `fromWire` does the normalizing, `toWire` writes back only
the canonical twelve fields — for the concrete implementation and
[`docs/DEVELOPER_GUIDE.md`](./DEVELOPER_GUIDE.md) §5b for the fuller
walkthrough (that section also covers the three-way merge this contract
feeds into).

## Why mobile keeps the effective price internally

This app's own `CartItem` type keeps `price` as the **effective** price
everywhere money is computed (subtotal, line totals, checkout) — the same
thing it always did before this contract existed — plus an optional
`listPrice`, present only when the item was added while on sale. That split
exists so nothing downstream of `price` has to know or care whether an item
is discounted; only the two places that render a struck-through list price
and the wire adapter need to look at `listPrice` at all. Writing to the wire
inverts that back to list/sale form (`price` = `listPrice ?? price`,
`sale_price` = the discounted price or `null`) so the row conforms to this
contract regardless of which app reads it next.
