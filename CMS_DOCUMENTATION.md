# Content Management System (CMS) Documentation

## Overview
The Admin CMS page allows administrators to manage all public-facing content on the homepage, including the Hero section, About Us, and Careers sections.

## Access
- **URL**: `/admin/cms`
- **Role Required**: `admin`
- **Location**: Admin Dashboard → Content Management (CMS)

## Features

### 1. Hero Section Management

#### Hero Background Image
- **Upload**: Choose an image file (JPG, PNG, WebP, GIF)
- **Recommended Size**: 1920x600px or wider
- **Max File Size**: 10MB
- **Preview**: View the current and new background before uploading

#### Hero Text Content
- **Hero Title**: Main heading (max 100 characters)
  - Default: "Frozen Foods"
  - Example: "Premium Frozen Foods"
  
- **Hero Subtitle/Highlight**: Accent text in gold color (max 50 characters)
  - Default: "Premium"
  - Example: "Quality Assured"
  
- **Hero Description**: Supporting text (max 300 characters)
  - Default: "Quality frozen products delivered to your door..."
  - Example: "Browse our extensive catalog of meats, seafood, and more"

---

### 2. About Us Section Management

The About Us section provides company information, mission, and values.

#### Content Fields

**Section Title** (max 100 characters)
- Database Key: `about_title`
- Default: "About FrozenHub"
- Displayed as the main heading

**Opening Description** (max 500 characters)
- Database Key: `about_description`
- Default: "At FrozenHub, we've been delivering premium quality frozen products..."
- Introductory paragraph about the company

**Mission Statement** (max 300 characters)
- Database Key: `about_mission`
- Default: "To provide the highest quality frozen goods..."
- Displayed in the Mission & Values card

**Core Values** (max 300 characters)
- Database Key: `about_values`
- Default: "We believe in quality, freshness, and customer satisfaction..."
- Displayed in the Mission & Values card

#### Visual Elements
- Quality Certified badge with Award icon
- Customer count badge with Users icon
- Mission card with Target icon
- Values card with Heart icon
- Stats grid showing Products, Branches, and Support

---

### 3. Careers Section Management

The Careers section showcases job opportunities and company benefits.

#### Content Fields

**Section Title** (max 100 characters)
- Database Key: `careers_title`
- Default: "Join Our Team"
- Main heading for the careers section

**Opening Description** (max 500 characters)
- Database Key: `careers_description`
- Default: "Build your career with the leading frozen foods distributor..."
- Introductory text about working at the company

**Job Positions** (JSON Format)
- Database Key: `careers_positions`
- Format: Array of job objects
- Each position must include:
  - `title`: Job title (string)
  - `department`: Department name (string)
  - `location`: Work location (string)
  - `type`: Employment type (string)
  - `description`: Job description (string)

#### JSON Example
```json
[
  {
    "title": "Warehouse Manager",
    "department": "Operations",
    "location": "Manila",
    "type": "Full-time",
    "description": "Oversee warehouse operations, inventory management, and team coordination."
  },
  {
    "title": "Delivery Driver",
    "department": "Logistics",
    "location": "Multiple Locations",
    "type": "Full-time",
    "description": "Safely transport frozen goods to customers and ensure timely deliveries."
  }
]
```

#### Fixed Benefits Section
The following benefits are displayed automatically:
- Career Growth (TrendingUp icon)
- Learning & Development (GraduationCap icon)
- Great Benefits (Heart icon)
- Amazing Team (Users icon)

---

## Database Structure

All CMS content is stored in the `settings` table with the following keys:

| Setting Key | Description | Max Length |
|------------|-------------|-----------|
| `hero_banner` | Hero background image path | - |
| `hero_title` | Hero main title | 100 |
| `hero_subtitle` | Hero subtitle/highlight | 50 |
| `hero_description` | Hero description text | 300 |
| `about_title` | About Us section title | 100 |
| `about_description` | About Us opening text | 500 |
| `about_mission` | Mission statement | 300 |
| `about_values` | Core values statement | 300 |
| `careers_title` | Careers section title | 100 |
| `careers_description` | Careers opening text | 500 |
| `careers_positions` | Job positions (JSON) | - |

---

## API Endpoints

### Get Setting
```
GET /api/settings/:key
Response: { setting: { id, setting_key, setting_value, updated_at, updated_by } }
```

### Update Setting
```
PUT /api/settings/:key
Body: { value: string }
Response: { setting: {...}, message: "Setting updated successfully" }
```

### Delete Setting
```
DELETE /api/settings/:key
Response: { message: "Setting deleted successfully" }
```

---

## Frontend Implementation

### Index.tsx (Homepage)

The homepage dynamically fetches and displays CMS content:

```typescript
// Fetch About Us content
const { data: aboutTitleData } = useQuery({
  queryKey: ["setting", "about_title"],
  queryFn: async () => {
    try {
      return await apiClient.getSetting("about_title");
    } catch (error) {
      return { setting: null };
    }
  },
  retry: false,
  staleTime: 5 * 60 * 1000,
});

// Use with fallback
const aboutTitle = aboutTitleData?.setting?.setting_value || "About FrozenHub";
```

### Fallback Values

If a setting is not found in the database, the system uses sensible defaults:
- All text fields have default values
- Careers positions default to 5 sample jobs
- Hero section shows placeholder text

---

## Best Practices

### Content Writing

1. **Keep it Concise**: Respect character limits for optimal display
2. **Be Clear**: Use simple, direct language
3. **Stay On-Brand**: Maintain consistent tone and messaging
4. **Proofread**: Check for spelling and grammar errors

### JSON Formatting (Careers)

1. **Validate JSON**: Use a JSON validator before saving
2. **Include All Fields**: Every position needs all 5 required fields
3. **Consistent Format**: Use the same structure for all positions
4. **Escape Quotes**: Use `\"` for quotes within strings

### Image Upload

1. **Optimize Images**: Compress images before uploading
2. **Use Correct Dimensions**: Wide landscape images work best
3. **Test Loading**: Check page load time after upload
4. **Maintain Quality**: Balance file size and visual quality

### Update Timing

1. **Off-Peak Hours**: Update content during low traffic periods
2. **Preview First**: Use "Preview Homepage" button before saving
3. **Incremental Updates**: Make small changes and test
4. **Cache Aware**: Content caches for 5 minutes (staleTime)

---

## Troubleshooting

### JSON Parse Error (Careers)
**Problem**: Invalid JSON format in careers_positions
**Solution**: 
1. Copy the example JSON template
2. Validate your JSON using jsonlint.com
3. Ensure all brackets, braces, and quotes match
4. Check for trailing commas (not allowed in JSON)

### Changes Not Appearing
**Problem**: Updates not showing on homepage
**Solution**:
1. Wait 5 minutes for cache to expire
2. Hard refresh the page (Ctrl+Shift+R)
3. Check if the setting was saved in CMS panel
4. Verify "Success" toast appeared after saving

### Image Not Displaying
**Problem**: Uploaded image doesn't show
**Solution**:
1. Check file size (must be under 10MB)
2. Verify image format (JPG, PNG, WebP, GIF only)
3. Ensure upload was successful
4. Check browser console for errors

### Content Too Long
**Problem**: Text exceeds character limit
**Solution**:
1. Edit text to be more concise
2. Focus on key messages
3. Use bullet points in longer sections
4. Split content across multiple fields

---

## Security

- All CMS endpoints require admin authentication
- Rate limiting: 50 requests per hour (strict)
- Input sanitization prevents XSS attacks
- File uploads restricted to images only
- Max file size enforced (10MB banners, 5MB products)

---

## Future Enhancements

Potential features for future versions:
- [ ] WYSIWYG editor for rich text formatting
- [ ] Image cropping and editing tools
- [ ] Multiple language support
- [ ] Content versioning and rollback
- [ ] Scheduled content publishing
- [ ] Preview mode before going live
- [ ] SEO metadata fields
- [ ] Social media integration

---

## Support

For technical issues or questions:
1. Check this documentation first
2. Verify database connection
3. Check browser console for errors
4. Review server logs for API errors
5. Contact system administrator

---

**Last Updated**: November 9, 2025
**Version**: 1.0
**System**: FrozenHub POS - Content Management System
