import requests
import pandas as pd
import os
from dotenv import load_dotenv

def fetch_lta_carparks(api_key):
    """
    Fetches live carpark availability from LTA DataMall, handling pagination.
    """
    url = "https://datamall2.mytransport.sg/ltaodataservice/CarParkAvailabilityv2"
    
    # This is how you authenticate with LTA
    headers = {
        "AccountKey": api_key,
        "accept": "application/json"
    }
    
    all_carparks = []
    skip = 0
    
    print("Connecting to LTA DataMall...")
    
    # Loop to grab 500 records at a time until the API stops giving us data
    while True:
        params = {"$skip": skip}
        
        try:
            response = requests.get(url, headers=headers, params=params)
            response.raise_for_status() # Catches 401 Unauthorized or 500 Server Errors
            
            data = response.json().get('value', [])
            
            # If the 'value' array is empty, we have reached the end of the list
            if len(data) == 0:
                break
                
            all_carparks.extend(data)
            print(f"Fetched {len(all_carparks)} records so far...")
            
            # Increment by 500 to get the next page on the next loop
            skip += 500
            
        except requests.exceptions.RequestException as e:
            print(f"Error fetching data from LTA: {e}")
            break

    # Convert the massive list of dictionaries into a clean Pandas DataFrame
    df = pd.DataFrame(all_carparks)
    print("Finished pulling LTA data!")
    
    return df

# --- HOW TO TEST IT ---
if __name__ == "__main__":
    # 1. Load the environment variables from the .env file
    load_dotenv()
    
    # 2. Grab the key from the system environment
    MY_LTA_KEY = os.getenv("LTA_API_KEY")
    
    # 3. Check if the key was actually found before trying to use it
    if MY_LTA_KEY:
        print(f"Key loaded successfully from .env (Starts with: {MY_LTA_KEY[:5]}...)")
        
        # 4. Run the fetcher
        carpark_df = fetch_lta_carparks(MY_LTA_KEY)
        
        # Peek at the data
        if not carpark_df.empty:
            print(carpark_df.head())
    else:
        print("❌ ERROR: Could not find LTA_API_KEY in the .env file.")
        print("Ensure your .env file is in the same folder and named correctly.")
