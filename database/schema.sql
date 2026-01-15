CREATE TABLE users (
  address TEXT PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  tags_given INTEGER DEFAULT 0,
  tags_received INTEGER DEFAULT 0,
  reputation_score INTEGER DEFAULT 0
);

CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_address TEXT NOT NULL REFERENCES users(address),
  target_handle TEXT NOT NULL,
  target_platform TEXT NOT NULL,
  tag_type TEXT NOT NULL CHECK (tag_type IN ('positive', 'negative', 'neutral')),
  text TEXT NOT NULL CHECK (char_length(text) <= 280),
  network TEXT DEFAULT 'polygon',
  signature TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(author_address, target_handle, target_platform)
);

CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  handle TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  reputation_score INTEGER DEFAULT 0,
  positive_tags INTEGER DEFAULT 0,
  negative_tags INTEGER DEFAULT 0,
  neutral_tags INTEGER DEFAULT 0,
  total_tags INTEGER DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(platform, handle)
);

CREATE INDEX idx_tags_target ON tags(target_platform, target_handle);
CREATE INDEX idx_tags_author ON tags(author_address);
CREATE INDEX idx_tags_created ON tags(created_at DESC);
CREATE INDEX idx_profiles_platform_handle ON profiles(platform, handle);
CREATE INDEX idx_profiles_score ON profiles(reputation_score DESC);

CREATE OR REPLACE FUNCTION update_profile_stats()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, platform, handle, reputation_score, positive_tags, negative_tags, neutral_tags, total_tags, last_updated)
  VALUES (
    NEW.target_platform || ':' || NEW.target_handle,
    NEW.target_platform,
    NEW.target_handle,
    CASE NEW.tag_type 
      WHEN 'positive' THEN 1 
      WHEN 'negative' THEN -1 
      ELSE 0 
    END,
    CASE WHEN NEW.tag_type = 'positive' THEN 1 ELSE 0 END,
    CASE WHEN NEW.tag_type = 'negative' THEN 1 ELSE 0 END,
    CASE WHEN NEW.tag_type = 'neutral' THEN 1 ELSE 0 END,
    1,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    reputation_score = profiles.reputation_score + 
      CASE NEW.tag_type 
        WHEN 'positive' THEN 1 
        WHEN 'negative' THEN -1 
        ELSE 0 
      END,
    positive_tags = profiles.positive_tags + CASE WHEN NEW.tag_type = 'positive' THEN 1 ELSE 0 END,
    negative_tags = profiles.negative_tags + CASE WHEN NEW.tag_type = 'negative' THEN 1 ELSE 0 END,
    neutral_tags = profiles.neutral_tags + CASE WHEN NEW.tag_type = 'neutral' THEN 1 ELSE 0 END,
    total_tags = profiles.total_tags + 1,
    last_updated = NOW();
  
  UPDATE users SET tags_given = tags_given + 1 WHERE address = NEW.author_address;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION upsert_user(user_address TEXT)
RETURNS users AS $$
DECLARE
  result users;
BEGIN
  INSERT INTO users (address, last_seen_at)
  VALUES (user_address, NOW())
  ON CONFLICT (address) DO UPDATE SET last_seen_at = NOW()
  RETURNING * INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_tag_created
  AFTER INSERT ON tags
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_stats();

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users are viewable by everyone" ON users FOR SELECT USING (true);
CREATE POLICY "Users can be created by anyone" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own record" ON users FOR UPDATE USING (true);

CREATE POLICY "Tags are viewable by everyone" ON tags FOR SELECT USING (true);
CREATE POLICY "Anyone can create tags" ON tags FOR INSERT WITH CHECK (true);

CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Profiles can be created/updated by system" ON profiles FOR ALL USING (true);

CREATE VIEW top_profiles AS
SELECT 
  p.*,
  (SELECT COUNT(*) FROM tags t WHERE t.target_platform = p.platform AND t.target_handle = p.handle) as tag_count
FROM profiles p
ORDER BY reputation_score DESC
LIMIT 100;

CREATE VIEW recent_tags AS
SELECT 
  t.*,
  u.reputation_score as author_reputation
FROM tags t
LEFT JOIN users u ON t.author_address = u.address
ORDER BY t.created_at DESC
LIMIT 100;