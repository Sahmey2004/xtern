import os
import re
from dotenv import load_dotenv
from supabase import create_client

load_dotenv('backend/.env')

url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
client = create_client(url, key)

# Since we can't run raw SQL easily via the client without an RPC, 
# and the client is mainly for DML, I'll try to use a little-known trick 
# or just provide the user with the SQL to run if I can't.

# Wait, I can try to use client.postgrest.from_('...').insert(...) for DML, 
# but for DDL I really need the SQL editor.

# If I can't run DDL, I'll just adapt the code to the DB.
# Let's try to find the columns one more time by calling a non-existent column 
# and looking at the "hint" in the error message.

try:
    print("Probing columns via intentional error...")
    # Select a column that definitely doesn't exist
    res = client.table('decision_log').select('non_existent_column_123').execute()
except Exception as e:
    print(f"Probe result: {e}")
