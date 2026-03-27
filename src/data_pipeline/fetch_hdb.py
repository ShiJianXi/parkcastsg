import requests
import pandas as pd

def fetch_hdb_carparks():
    # The official Data.gov.sg endpoint for HDB carparks
    url = "https://api.data.gov.sg/v1/transport/carpark-availability"
    
    print("Fetching live HDB carpark data...")
    
    try:
        response = requests.get(url)
        response.raise_for_status()
        
        json_data = response.json()
        
        # The data is nested deep inside 'items' and 'carpark_data'
        carpark_list = json_data['items'][0]['carpark_data']
        
        clean_data = []
        
        for cp in carpark_list:
            carpark_no = cp['carpark_number']
            
            # Extract the lot info (we grab the first one, which is usually 'C' for Cars)
            info = cp['carpark_info'][0] 
            
            clean_data.append({
                'carpark_id': carpark_no,
                'total_lots': int(info['total_lots']),
                'available_lots': int(info['lots_available']),
                'lot_type': info['lot_type']
            })
            
        df = pd.DataFrame(clean_data)
        print(f"Successfully pulled {len(df)} HDB carparks!")
        
        return df

    except requests.exceptions.RequestException as e:
        print(f"Error fetching data from HDB: {e}")

# --- HOW TO TEST IT ---
if __name__ == "__main__":
    hdb_df = fetch_hdb_carparks()
    print(hdb_df.head())