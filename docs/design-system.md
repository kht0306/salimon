# Salimon UI System

Salimon uses a quiet, high-density B2B dashboard language inspired by mature financial and operations products.

## Design tokens

- **Color:** Neutral zinc surfaces carry the interface. Teal is reserved for selection and focus, green for income/success, and red for expense/destructive actions.
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

