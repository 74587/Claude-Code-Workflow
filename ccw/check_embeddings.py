import sqlite3
import os

# Find all _index.db files
root_dir = r'C:\Users\dyw\.codexlens\indexes\D\Claude_dms3\ccw'
index_files = []
for dirpath, dirnames, filenames in os.walk(root_dir):
    if '_index.db' in filenames:
        index_files.append(os.path.join(dirpath, '_index.db'))

print(f'Found {len(index_files)} index databases\n')

total_files = 0
total_chunks = 0
dirs_with_chunks = 0

for db_path in sorted(index_files):
    rel_path = db_path.replace(r'C:\Users\dyw\.codexlens\indexes\D\Claude_dms3\ccw\\', '')
    conn = sqlite3.connect(db_path)
    
    try:
        cursor = conn.execute('SELECT COUNT(*) FROM files')
        file_count = cursor.fetchone()[0]
        total_files += file_count
        
        try:
            cursor = conn.execute('SELECT COUNT(*) FROM semantic_chunks')
            chunk_count = cursor.fetchone()[0]
            total_chunks += chunk_count
            
            if chunk_count > 0:
                dirs_with_chunks += 1
                print(f'[+] {rel_path:<40} Files: {file_count:3d}  Chunks: {chunk_count:3d}')
            else:
                print(f'[ ] {rel_path:<40} Files: {file_count:3d}  (no chunks)')
        except sqlite3.OperationalError:
            print(f'[ ] {rel_path:<40} Files: {file_count:3d}  (no semantic_chunks table)')
    except Exception as e:
        print(f'[!] {rel_path:<40} Error: {e}')
    finally:
        conn.close()

print(f'\n=== Summary ===')
print(f'Total index databases: {len(index_files)}')
print(f'Directories with embeddings: {dirs_with_chunks}')
print(f'Total files indexed: {total_files}')
print(f'Total semantic chunks: {total_chunks}')
