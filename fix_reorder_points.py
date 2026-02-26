import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv('backend/.env')

url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
client = create_client(url, key)

# Get some inventory rows
res = client.table('inventory').select('*').limit(5).execute()
rows = res.data

for row in rows:
    new_rp = row['current_stock'] + row['in_transit'] + 50
    client.table('inventory').update({'reorder_point': new_rp}).eq('sku', row['sku']).execute()
    print(f"Updated {row['sku']}: Reorder Point set to {new_rp}")

print("Fixed reorder points for 5 SKUs.")
