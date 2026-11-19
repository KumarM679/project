import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'urban_flood.db')
SQL_DIR = os.path.join(os.path.dirname(__file__), 'sql')

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initializes the database using pure SQL DDL from sql/schema.sql"""
    conn = get_db_connection()
    schema_path = os.path.join(SQL_DIR, 'schema.sql')
    if os.path.exists(schema_path):
        with open(schema_path, 'r', encoding='utf-8') as f:
            conn.executescript(f.read())
    conn.commit()
    conn.close()

if __name__ == '__main__':
    init_db()
    print(f"Database initialized successfully at {DB_PATH} using {os.path.join(SQL_DIR, 'schema.sql')}")
