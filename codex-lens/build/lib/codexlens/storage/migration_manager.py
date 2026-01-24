"""
Manages database schema migrations.

This module provides a framework for applying versioned migrations to the SQLite
database. Migrations are discovered from the `codexlens.storage.migrations`
package and applied sequentially. The database schema version is tracked using
the `user_version` pragma.
"""

import importlib
import logging
import pkgutil
from pathlib import Path
from sqlite3 import Connection
from typing import List, NamedTuple

log = logging.getLogger(__name__)


class Migration(NamedTuple):
    """Represents a single database migration."""

    version: int
    name: str
    upgrade: callable


def discover_migrations() -> List[Migration]:
    """
    Discovers and returns a sorted list of database migrations.

    Migrations are expected to be in the `codexlens.storage.migrations` package,
    with filenames in the format `migration_XXX_description.py`, where XXX is
    the version number. Each migration module must contain an `upgrade` function
    that takes a `sqlite3.Connection` object as its argument.

    Returns:
        A list of Migration objects, sorted by version.
    """
    import codexlens.storage.migrations

    migrations = []
    package_path = Path(codexlens.storage.migrations.__file__).parent
    
    for _, name, _ in pkgutil.iter_modules([str(package_path)]):
        if name.startswith("migration_"):
            try:
                version = int(name.split("_")[1])
                module = importlib.import_module(f"codexlens.storage.migrations.{name}")
                if hasattr(module, "upgrade"):
                    migrations.append(
                        Migration(version=version, name=name, upgrade=module.upgrade)
                    )
                else:
                    log.warning(f"Migration {name} is missing 'upgrade' function.")
            except (ValueError, IndexError) as e:
                log.warning(f"Could not parse migration name {name}: {e}")
            except ImportError as e:
                log.warning(f"Could not import migration {name}: {e}")

    migrations.sort(key=lambda m: m.version)
    return migrations


class MigrationManager:
    """
    Manages the application of migrations to a database.
    """

    def __init__(self, db_conn: Connection):
        """
        Initializes the MigrationManager.

        Args:
            db_conn: The SQLite database connection.
        """
        self.db_conn = db_conn
        self.migrations = discover_migrations()

    def get_current_version(self) -> int:
        """
        Gets the current version of the database schema.

        Returns:
            The current schema version number.
        """
        return self.db_conn.execute("PRAGMA user_version").fetchone()[0]

    def set_version(self, version: int):
        """
        Sets the database schema version.

        Args:
            version: The version number to set.
        """
        self.db_conn.execute(f"PRAGMA user_version = {version}")
        log.info(f"Database schema version set to {version}")

    def apply_migrations(self):
        """
        Applies all pending migrations to the database.

        This method checks the current database version and applies all
        subsequent migrations in order. Each migration is applied within
        a transaction, unless the migration manages its own transactions.
        """
        current_version = self.get_current_version()
        log.info(f"Current database schema version: {current_version}")

        for migration in self.migrations:
            if migration.version > current_version:
                log.info(f"Applying migration {migration.version}: {migration.name}...")
                try:
                    # Check if a transaction is already in progress
                    in_transaction = self.db_conn.in_transaction

                    # Only start transaction if not already in one
                    if not in_transaction:
                        self.db_conn.execute("BEGIN")

                    migration.upgrade(self.db_conn)
                    self.set_version(migration.version)

                    # Only commit if we started the transaction and it's still active
                    if not in_transaction and self.db_conn.in_transaction:
                        self.db_conn.execute("COMMIT")

                    log.info(
                        f"Successfully applied migration {migration.version}: {migration.name}"
                    )
                except Exception as e:
                    log.error(
                        f"Failed to apply migration {migration.version}: {migration.name}. Error: {e}",
                        exc_info=True,
                    )
                    # Try to rollback if transaction is active
                    try:
                        if self.db_conn.in_transaction:
                            self.db_conn.execute("ROLLBACK")
                    except Exception:
                        pass  # Ignore rollback errors
                    raise

        latest_migration_version = self.migrations[-1].version if self.migrations else 0
        if current_version < latest_migration_version:
            # This case can be hit if migrations were applied but the loop was exited
            # and set_version was not called for the last one for some reason.
            # To be safe, we explicitly set the version to the latest known migration.
            final_version = self.get_current_version()
            if final_version != latest_migration_version:
                 log.warning(f"Database version ({final_version}) is not the latest migration version ({latest_migration_version}). This may indicate a problem.")

        log.info("All pending migrations applied successfully.")

