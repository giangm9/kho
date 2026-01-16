# UI Guidelines

## Icons

**KHÔNG sử dụng emoji** - Thay vào đó dùng **React Icons**

### Setup React Icons

```bash
npm install react-icons
```

### Usage

```tsx
import { FaCheck, FaCircle, FaHome } from 'react-icons/fa';
import { MdArrowBack } from 'react-icons/md';
import { IoMdSettings } from 'react-icons/io';

// Thay vì: ✓ ○ 🏠
// Dùng:
<FaCheck />
<FaCircle />
<FaHome />
```

### Available Icon Sets

- `fa` - Font Awesome
- `md` - Material Design
- `io` - Ionicons
- `ai` - Ant Design
- `bi` - Bootstrap Icons
- `hi` - Hero Icons

### Example

```tsx
// BAD - Emoji
<span>✓</span>
<h1>🏗️ Kho Demos</h1>

// GOOD - React Icons
import { FaCheck } from 'react-icons/fa';
import { MdConstruction } from 'react-icons/md';

<FaCheck />
<h1><MdConstruction /> Kho Demos</h1>
```

## Colors

- Primary: `#0066cc`
- Success: `#4caf50`
- Warning: `#ff9800`
- Grey: `#666`

## Typography

- Font: `system-ui, -apple-system, sans-serif`
- Headings: Bold, clear hierarchy
- Code: `'Courier New', monospace`
