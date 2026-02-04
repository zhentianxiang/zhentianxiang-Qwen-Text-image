import asyncio
import logging
import sys
import os

# Add the project root to sys.path to allow imports from app
sys.path.append(os.getcwd())

from sqlalchemy import text, create_engine
from app.config import settings
from app.models.database import Base, get_database_url

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("migration")

def migrate():
    """
    Migrate the database to remove the UNIQUE constraint on the email column.
    
    Strategy:
    1. Rename 'users' table to 'users_old'.
    2. Create new 'users' table using the updated SQLAlchemy model.
    3. Copy data from 'users_old' to 'users'.
    4. Drop 'users_old'.
    """
    
    db_url = get_database_url()
    logger.info(f"Connecting to database: {db_url}")
    
    if "sqlite" not in db_url:
        logger.error("This migration script is optimized for SQLite. For other databases, please use 'ALTER TABLE DROP CONSTRAINT'.")
        return

    engine = create_engine(db_url)
    
    with engine.connect() as conn:
        # Check if users table exists
        result = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='users'"))
        if not result.scalar():
            logger.info("Table 'users' does not exist. Creating it now...")
            Base.metadata.create_all(bind=engine)
            logger.info("Done.")
            return

        logger.info("Starting migration...")
        
        try:
            # 1. Rename table
            logger.info("Renaming 'users' to 'users_old'...")
            conn.execute(text("ALTER TABLE users RENAME TO users_old"))
            
            # 2. Create new table
            # We use the updated model definition in app.models.database (where unique=True was removed)
            logger.info("Creating new 'users' table...")
            Base.metadata.create_all(bind=engine)
            
            # 3. Copy data
            # We need to list columns explicitly to be safe, or select * if schemas match exactly (which they should, except for the constraint)
            logger.info("Copying data...")
            # Get columns from the new table to ensure we only copy relevant columns
            # But simplest is usually:
            conn.execute(text("INSERT INTO users SELECT * FROM users_old"))
            
            # 4. Drop old table
            logger.info("Dropping 'users_old'...")
            conn.execute(text("DROP TABLE users_old"))
            
            conn.commit()
            logger.info("Migration completed successfully! 'users' table email column no longer has a UNIQUE constraint.")
            
        except Exception as e:
            logger.error(f"Migration failed: {e}")
            logger.info("Rolling back changes (if possible manually)... check if 'users_old' exists.")
            # Since DDL in SQLite is transactional (mostly), if it failed, we might be in a weird state.
            # But renaming back is usually safe if the first step succeeded and others failed.
            raise e

if __name__ == "__main__":
    migrate()
