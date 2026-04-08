# Promotional Banner CMS - Enhanced Features

## Overview
The Promotional Banner CMS now includes comprehensive customization options, allowing full control over appearance, content, and behavior of the promotional section on your homepage.

## New CMS Options Added

### 1. **Display Toggle**
- **Setting Key**: `promo_enabled`
- **Type**: Boolean (true/false)
- **Default**: true
- **Description**: Show or hide the entire promotional banner section
- **Use Case**: Temporarily disable promotions without losing saved content

### 2. **Background Color**
- **Setting Key**: `promo_bg_color`
- **Type**: Color (hex code)
- **Default**: `#d97706` (gold-600)
- **Description**: Custom background color with automatic gradient generation
- **Features**:
  - Color picker for easy selection
  - Text input for manual hex code entry
  - Automatically creates gradient effect (lighter shade in middle)

### 3. **Badge Text**
- **Setting Key**: `promo_subtitle`
- **Type**: Text (max 50 characters)
- **Default**: "Limited Time Offer"
- **Description**: Small text displayed in the badge at the top
- **Examples**: "Flash Sale", "New Arrival", "Exclusive Deal", "Weekend Special"

### 4. **Main Title**
- **Setting Key**: `promo_title`
- **Type**: Text (max 100 characters)
- **Default**: "Special Holiday Sale!"
- **Description**: Large heading text
- **Examples**: "Black Friday Mega Sale!", "Buy 1 Take 1 Promo", "End of Season Clearance"

### 5. **Description**
- **Setting Key**: `promo_description`
- **Type**: Text (max 300 characters, HTML supported)
- **Default**: "Get up to 30% OFF on selected frozen products..."
- **Description**: Detailed promotional message
- **HTML Support**: Use tags like `<span class="font-bold">text</span>` for emphasis
- **Examples**:
  ```
  Get up to <span class="font-bold text-2xl">50% OFF</span> on all frozen seafood. Limited time only!
  
  Fresh arrivals this weekend! New shipment of premium frozen products just arrived.
  ```

### 6. **Primary Button**
- **Setting Keys**: 
  - `promo_button1_text` (max 30 characters)
  - `promo_button1_link` (max 200 characters)
- **Default**: 
  - Text: "Shop Now"
  - Link: "/shop"
- **Description**: Main call-to-action button (black background)
- **Link Options**:
  - Internal page: `/shop`, `/products`, `/deals`
  - Anchor link: `#products`, `#about`
  - External URL: `https://example.com`

### 7. **Secondary Button**
- **Setting Keys**: 
  - `promo_button2_text` (max 30 characters)
  - `promo_button2_link` (max 200 characters)
- **Default**: 
  - Text: "View Deals"
  - Link: "/deals"
- **Description**: Secondary call-to-action button (white outline)
- **Link Options**: Same as primary button

## Admin Interface Features

### Layout
The CMS panel is organized into logical sections:

1. **Banner Visibility** - Toggle section at the top
2. **Background Color** - Color picker + hex input
3. **Content Fields** - Badge, Title, Description
4. **CTA Buttons** - Two-column grid with button text and links
5. **Actions** - Save and Reset buttons

### User Experience
- **Character Counters**: Visual feedback on field limits
- **Helper Text**: Guidance for each field
- **Reset Functionality**: Revert all changes to saved values
- **Real-time Validation**: Prevents overly long inputs
- **Responsive Design**: Works on desktop and mobile

## Usage Examples

### Holiday Sale Campaign
```
Enabled: ✓
Background: #c41e3a (red)
Badge: "Holiday Special"
Title: "Christmas Mega Sale!"
Description: "Celebrate the season with up to 40% OFF on selected items. Stock up for your holiday gatherings!"
Button 1: "Shop Holiday Deals" → /shop
Button 2: "View Catalog" → #products
```

### New Product Launch
```
Enabled: ✓
Background: #2563eb (blue)
Badge: "New Arrival"
Title: "Fresh Frozen Seafood Just In!"
Description: "Premium quality <span class="font-bold">Norwegian Salmon</span> and <span class="font-bold">Tiger Prawns</span> now available."
Button 1: "See What's New" → /products?new=true
Button 2: "Contact Us" → /contact
```

### Buy 1 Take 1 Promo
```
Enabled: ✓
Background: #16a34a (green)
Badge: "Limited Time"
Title: "Buy 1 Take 1 on Selected Items!"
Description: "Double the value! Get two for the price of one on participating products. While supplies last."
Button 1: "Browse Promo Items" → /shop?promo=b1t1
Button 2: "Terms & Conditions" → /promo-terms
```

### Maintenance Mode (Banner Hidden)
```
Enabled: ✗
(All other settings preserved for when you re-enable)
```

## Technical Details

### Database Schema
All settings stored in the `settings` table with these keys:
- `promo_enabled`
- `promo_bg_color`
- `promo_subtitle`
- `promo_title`
- `promo_description`
- `promo_button1_text`
- `promo_button1_link`
- `promo_button2_text`
- `promo_button2_link`

### API Endpoints
- **GET** `/api/settings/:key` - Fetch individual setting
- **PUT** `/api/settings` - Update setting (admin only)

### Caching
- 5-minute cache on frontend queries
- Cache automatically invalidated on save

### Gradient Generation
The `adjustBrightness()` function automatically creates a three-color gradient:
1. Start: Base color
2. Middle: Base color + 20 brightness
3. End: Base color

This creates a subtle, professional gradient effect.

## Best Practices

### Content Guidelines
1. **Badge Text**: Keep it short and urgent (3-5 words)
2. **Main Title**: Clear and compelling (5-10 words)
3. **Description**: Explain the value proposition (20-40 words)
4. **Button Text**: Action-oriented verbs ("Shop", "Browse", "Discover")

### Color Selection
- **Warm colors** (red, orange, gold): Urgency, sales, excitement
- **Cool colors** (blue, green): Trust, new products, sustainability
- **Contrast**: Ensure text remains readable (white text on dark/bright backgrounds)

### Link Strategy
- **Primary Button**: Main conversion goal (e.g., product catalog)
- **Secondary Button**: Supporting action (e.g., learn more, contact)
- Use internal links (`/shop`) for better analytics
- Use anchor links (`#products`) for smooth scrolling

### Timing
- Update weekly for regular promotions
- Change seasonally for holiday campaigns
- Test different messages to see what resonates
- Disable when no active promotions to avoid "banner blindness"

## Troubleshooting

### Banner Not Showing
- Check that `promo_enabled` is set to `true`
- Verify user has admin role to access CMS
- Clear browser cache and refresh

### Colors Not Updating
- Ensure hex codes start with `#`
- Valid format: `#RRGGBB` (e.g., `#d97706`)
- Save changes and wait for cache to refresh (5 minutes)

### Buttons Not Working
- Verify link format (no spaces)
- Internal links need leading slash (`/shop`, not `shop`)
- External links need protocol (`https://example.com`)
- Test in different browsers

### HTML Not Rendering
- Only certain tags supported in description field
- Use simple inline styles: `<span class="font-bold">text</span>`
- Avoid complex HTML structures
- Test output before saving

## Future Enhancements
Potential additions to consider:
- Background image option (similar to Featured Products)
- Countdown timer for limited-time offers
- Multiple promotional banners with rotation
- A/B testing capabilities
- Schedule promotions (start/end dates)
- Preview mode before publishing
