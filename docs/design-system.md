# Salimon UI System

Salimon uses a quiet, high-density B2B dashboard language inspired by mature financial and operations products.

## Design tokens

- **Color:** Neutral zinc surfaces carry the interface. Teal is reserved for selection and focus, green for income/success, and red for destructive actions, cancellations, errors, and exceeded limits. Normal expense amounts use the primary ink color.
- **Radius:** 4px for compact controls, 6px for buttons and fields, and 8px for panels. Pills are limited to counts and status dots.
- **Borders and elevation:** Structure comes from 1px borders. Shadows are subtle and used only for floating layers.
- **Spacing:** The base unit is 4px. Standard control height is 34-36px, panel padding is 16-20px, and workspace gutters are 24-28px.
- **Typography:** Geist Sans is the interface face. Geist Mono is limited to times, invite codes, and compact financial figures. Page titles stay between 24px and 28px.

## Component rules

- Sidebar items use icon + label and one quiet selected state; they do not look like standalone cards.
- Panels are flat, bordered work surfaces. Avoid cards inside cards.
- Buttons use icons for compact actions and icon + text only for explicit commands.
- Inputs share one height, border, focus ring, and label treatment.
- Calendar cells form one continuous data grid. Selection is shown with an inset accent rather than a detached tile.
- Empty states are short, low-contrast rows. They should not explain the product or fill large decorative areas.
- Status is communicated with a dot and text. Rounded status containers are avoided unless the value is a count.
- Motion is limited to color, border, and opacity transitions and respects reduced-motion preferences.

## Mobile application rules

- Pretendard is the Android interface typeface. Display, title, section, body, label, and caption roles come from the shared native typography tokens.
- The canvas uses a quiet light gray while primary content sits on white panels. Black hero cards, decorative gradients, and competing category colors are not used for hierarchy.
- Deep teal is the only product accent for primary actions and selection. Green is limited to income or success; amber indicates review or exceeded budgets; red indicates cancellation, deletion, or failure.
- Lucide icons are used at a consistent 1.8-2.2 stroke width. Text glyphs and hand-drawn view shapes are not used as interface icons.
- Bottom navigation remains flat. The active destination is communicated by teal icon and label color rather than a filled tile.
- Touch targets are at least 44px. Prominent actions are 48px high, use an 8px radius, and avoid heavy shadows.
- Home, transaction, inbox, settlement, settings, and authentication screens share the same 16px mobile gutter and 1px panel borders.
- Loading states retain the target layout with skeleton blocks so navigation and page structure do not disappear while data is fetched.
