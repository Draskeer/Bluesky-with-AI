CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    message_id INT UNIQUE NOT NULL,
    is_fake BOOLEAN DEFAULT FALSE,
    confidence FLOAT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) UNIQUE NOT NULL,
    message_count INTEGER DEFAULT 0,
    trust_rate FLOAT DEFAULT 0.5
);

CREATE INDEX IF NOT EXISTS idx_users_id ON users(user_id);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO bluesky;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO bluesky;
