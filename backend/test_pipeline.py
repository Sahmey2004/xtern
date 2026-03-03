import os

# Set python path to include the current directory
import sys
sys.path.append(os.getcwd())
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from config import load_project_env

load_project_env()

from backend.graph.pipeline import run_pipeline

def test_run():
    print("=== Starting Pipeline Test ===")
    
    # Run for all SKUs below reorder point
    try:
        final_state = run_pipeline(
            skus=[], 
            triggered_by='test_script', 
            horizon=3
        )
        
        if final_state.get('error'):
            print(f"ERROR in pipeline: {final_state['error']}")
            print(f"Current Agent: {final_state.get('current_agent')}")
        else:
            print(f"SUCCESS! PO Created: {final_state.get('po_number')}")
            print(f"Total USD: ${final_state.get('po_total_usd'):,.2f}")
            print(f"Rationale: {final_state.get('po_rationale')}")
            
    except Exception as e:
        print(f"CRITICAL EXCEPTION: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_run()
