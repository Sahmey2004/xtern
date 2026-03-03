import os
import json
from dotenv import load_dotenv
from supabase import create_client

load_dotenv('backend/.env')

url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
client = create_client(url, key)

res = client.table('inventory').select('*').execute()
print(f"Total inventory rows: {len(res.data)}")

if len(res.data) > 0:
    below = [r for r in res.data if (r['current_stock'] + r['in_transit']) <= r['reorder_point']]
    print(f"Rows below reorder: {len(below)}")
    if len(below) > 0:
        print("Example below reorder:")
        print(json.dumps(below[0], indent=2))
    else:
        print("No items are currently below reorder point.")
        print("Example item:")
        print(json.dumps(res.data[0], indent=2))
else:
    print("Database is EMPTY!")
