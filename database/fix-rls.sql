DROP POLICY IF EXISTS "Tags are viewable by everyone" ON tags;
DROP POLICY IF EXISTS "Anyone can create tags" ON tags;
DROP POLICY IF EXISTS "Tags: select" ON tags;
DROP POLICY IF EXISTS "Tags: insert" ON tags;
DROP POLICY IF EXISTS "Tags: update" ON tags;
DROP POLICY IF EXISTS "Tags: delete" ON tags;

DROP POLICY IF EXISTS "Users are viewable by everyone" ON users;
DROP POLICY IF EXISTS "Users can be created by anyone" ON users;
DROP POLICY IF EXISTS "Users can update own record" ON users;
DROP POLICY IF EXISTS "Users: select" ON users;
DROP POLICY IF EXISTS "Users: insert" ON users;
DROP POLICY IF EXISTS "Users: update" ON users;

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Profiles can be created/updated by system" ON profiles;
DROP POLICY IF EXISTS "Profiles: select" ON profiles;
DROP POLICY IF EXISTS "Profiles: insert" ON profiles;
DROP POLICY IF EXISTS "Profiles: update" ON profiles;

CREATE POLICY "Users: select" ON users FOR SELECT USING (true);
CREATE POLICY "Users: insert" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Users: update" ON users FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Tags: select" ON tags FOR SELECT USING (true);
CREATE POLICY "Tags: insert" ON tags FOR INSERT WITH CHECK (true);
CREATE POLICY "Tags: update" ON tags FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Profiles: select" ON profiles FOR SELECT USING (true);
CREATE POLICY "Profiles: insert" ON profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Profiles: update" ON profiles FOR UPDATE USING (true) WITH CHECK (true);