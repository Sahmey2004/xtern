import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv('backend/.env')
client = create_client(os.getenv('NEXT_PUBLIC_SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_ROLE_KEY'))

# Try to insert with a random supplier_id to see what is missing
try:
    print("Probing purchase_orders with supplier_id and amount...")
    res = client.table('purchase_orders').insert({
        'po_number': 'PROBE-SUP-' + os.urandom(2).hex(),
        'supplier_id': 'SUP-A',
        'status': 'draft',
        'amount': 99.99
    }).execute()
    if res.data:
        print("SUCCESS! Columns:", res.data[0].keys())
    else:
        print("Success but no data returned.")
except Exception as e:
    print(f"FAILED: {e}")
