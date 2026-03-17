import requests
import pandas as pd

def fetch_weather_data():
    # The real-time endpoint for the 2-hour forecast
    url = "https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast"
    
    print("Fetching live NEA Weather data...")
    try:
        response = requests.get(url)
        response.raise_for_status() 
        
        json_data = response.json()
        
        # Extract the area metadata (coordinates) and the actual forecasts
        area_metadata = json_data['data']['area_metadata']
        forecasts = json_data['data']['items'][0]['forecasts']
        
        # Convert both lists into pandas DataFrames
        df_areas = pd.DataFrame(area_metadata)
        
        # Flatten the nested latitude/longitude dictionary
        df_areas['latitude'] = df_areas['label_location'].apply(lambda x: x['latitude'])
        df_areas['longitude'] = df_areas['label_location'].apply(lambda x: x['longitude'])
        df_areas = df_areas.drop(columns=['label_location'])
        
        df_forecasts = pd.DataFrame(forecasts)
        
        # Merge the coordinates and forecasts together based on the area name
        final_df = pd.merge(df_areas, df_forecasts, left_on='name', right_on='area')
        final_df = final_df.drop(columns=['area'])
        
        print(f"Successfully fetched weather for {len(final_df)} stations!")
        return final_df

    except requests.exceptions.RequestException as e:
        print(f"Failed to fetch data: {e}")
        return pd.DataFrame() # Return empty dataframe on failure so the pipeline doesn't crash

# --- HOW TO TEST IT ---
if __name__ == "__main__":
    weather_df = fetch_weather_data()
    print(weather_df.head())