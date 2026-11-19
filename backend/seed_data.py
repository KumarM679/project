"""
Seed data generator for JalDrishti: Urban Flood Nowcasting System.
Populates standard demonstration records directly from SQL DML (sql/seed_data.sql).
"""

import os
from database import get_db_connection, init_db, SQL_DIR

def seed_all():
    """Populates all demonstration records using pure SQL DML statements."""
    init_db()
    conn = get_db_connection()
    seed_path = os.path.join(SQL_DIR, 'seed_data.sql')
    if os.path.exists(seed_path):
        with open(seed_path, 'r', encoding='utf-8') as f:
            conn.executescript(f.read())
    conn.commit()
    conn.close()
    print("Seed data successfully populated from sql/seed_data.sql!")

if __name__ == "__main__":
    seed_all()
