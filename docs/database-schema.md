# Database Schema

## Tables
### users
- id (uuid, primary key)
- email (text, unique)
- created_at (timestamp)

### clients
- id (uuid, primary key)
- name (text)
- user_id (uuid, foreign key)