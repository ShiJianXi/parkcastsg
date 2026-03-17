import numpy as np
import pandas as pd

def calculate_haversine_distance(lat1, lon1, lat2, lon2):
    """
    Calculates the Great-Circle distance in kilometers between two GPS points.
    Uses numpy for lightning-fast vectorized math.
    """
    # Convert decimal degrees to radians for the math to work
    lat1, lon1, lat2, lon2 = map(np.radians, [lat1, lon1, lat2, lon2])

    # Haversine formula
    dlat = lat2 - lat1 
    dlon = lon2 - lon1 
    a = np.sin(dlat/2)**2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon/2)**2
    c = 2 * np.arcsin(np.sqrt(a)) 
    
    # 6371 is the radius of the Earth in kilometers
    r = 6371 
    return c * r

def map_carparks_to_weather(carparks_df, weather_df):
    """
    Loops through every carpark, finds the geographically closest weather station,
    and tags the carpark with that weather data.
    """
    print("Mapping carparks to nearest weather stations...")
    
    # Safety check: if either API failed and returned empty data, stop here
    if carparks_df.empty or weather_df.empty:
        print("Error: Missing data. Cannot map carparks to weather.")
        return carparks_df
    
    mapped_results = []
    
    # Loop through every single carpark
    for index, carpark in carparks_df.iterrows():
        # Calculate the distance from THIS carpark to EVERY weather station at once
        distances = calculate_haversine_distance(
            carpark['latitude'], 
            carpark['longitude'],
            weather_df['latitude'].values, 
            weather_df['longitude'].values
        )
        
        # Find the index of the weather station with the absolute minimum distance
        nearest_station_index = np.argmin(distances)
        nearest_station = weather_df.iloc[nearest_station_index]
        
        # Save the combined data into a new dictionary
        mapped_results.append({
            'carpark_id': carpark.get('carpark_id', carpark.get('CarParkID', 'UNKNOWN')),
            'available_lots': carpark.get('available_lots', carpark.get('AvailableLots', 0)),
            'latitude': carpark['latitude'],
            'longitude': carpark['longitude'],
            'nearest_weather_station': nearest_station['name'],
            'current_weather': nearest_station['forecast'],
            'distance_to_station_km': round(distances[nearest_station_index], 2)
        })
        
    # Convert the results back into a clean Pandas DataFrame
    final_df = pd.DataFrame(mapped_results)
    print(f"Successfully mapped {len(final_df)} carparks to weather stations!")
    
    return final_df

# --- HOW TO TEST IT ---
if __name__ == "__main__":
    # 1. Fake carpark data (to simulate what your LTA/HDB scripts will pass in)
    mock_carparks = pd.DataFrame({
        'carpark_id': ['TAMP_01', 'ORCH_02', 'JUR_03'],
        'latitude': [1.3521, 1.3038, 1.3329],
        'longitude': [103.9450, 103.8320, 103.7436],
        'available_lots': [45, 12, 150]
    })
    
    # 2. Fake weather data (to simulate what your NEA script will pass in)
    mock_weather = pd.DataFrame({
        'name': ['Tampines', 'City Hall', 'Jurong West'],
        'latitude': [1.3496, 1.2929, 1.3404],
        'longitude': [103.9568, 103.8525, 103.7090],
        'forecast': ['Showers', 'Fair', 'Cloudy']
    })
    
    # 3. Run the mapping
    final_mapped_data = map_carparks_to_weather(mock_carparks, mock_weather)
    
    print("\nFinal Output for the Database:")
    print(final_mapped_data)