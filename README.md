# REPID - Decentralized Reputation Protocol

Chrome extension for leaving verifiable reputation tags on social media profiles.

## Features

-  Connect any Web3 wallet (MetaMask, Phantom)
-  Leave positive, negative, or neutral reputation tags
-  All tags are cryptographically signed
-  View reputation scores on profiles
-  Supports: X (Twitter), GitHub, LinkedIn, YouTube, Reddit

## Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Go to **SQL Editor** and run the schema from `database/schema.sql`
4. Go to **Settings > API** and copy:
   - Project URL (e.g., `https://xxxxx.supabase.co`)
   - `anon` public key

### 2. Configure Extension

1. Open `config.js` in the extension folder
2. Replace the placeholder values:

```javascript
const REPID_CONFIG = {
  SUPABASE_URL: 'https://YOUR_PROJECT.supabase.co',
  SUPABASE_ANON_KEY: 'your-anon-key-here'
};
```

### 3. Install Extension

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `repid-extension` folder

## Usage

1. **Connect Wallet**: Click the REPID icon and connect your wallet
2. **Navigate to Profile**: Go to any supported platform profile (e.g., x.com/username)
3. **Add Tag**: Select tag type, write your message, and sign with your wallet
4. **View Reputation**: See reputation scores displayed on profiles

## Database Schema

### Tables

- **users**: Wallet addresses and stats
- **tags**: Reputation attestations with signatures
- **profiles**: Aggregated reputation scores

### Security

- Row Level Security (RLS) enabled
- Anyone can read tags (public reputation)
- Only signed attestations are stored

## Tech Stack

- Chrome Extension (Manifest V3)
- Supabase (PostgreSQL)
- Web3 wallet signing (EIP-191)

## License

MIT
