import pandas as pd
from pyproj import Transformer

# For one time run only

def generate_clean_hdb_coords():
    print("Loading raw HDB carpark data...")
    try:
        df = pd.read_csv("hdbcarparkinformation.csv")
    except FileNotFoundError:
        print("Error: Could not find 'hdb_carpark_information.csv'.")
        return

    # EPSG:3414 is SVY21 (Singapore), EPSG:4326 is WGS84 (Standard GPS)
    transformer = Transformer.from_crs("EPSG:3414", "EPSG:4326", always_xy=True)

    print("Converting SVY21 X/Y meters into GPS Latitude/Longitude...")
    
    def convert_coordinates(row):
        # Transform X and Y into Longitude and Latitude
        lng, lat = transformer.transform(row['x_coord'], row['y_coord'])
        return pd.Series({'latitude': lat, 'longitude': lng})

    # Apply the conversion
    coords_df = df.apply(convert_coordinates, axis=1)

    # UPDATED: Use the correct 'car_park_no' header
    clean_df = pd.concat([df['car_park_no'], coords_df], axis=1)
    
    # Rename it to 'carpark_id' so it perfectly matches our pipeline contract
    clean_df = clean_df.rename(columns={'car_park_no': 'carpark_id'})

    # Save the final clean CSV!
    clean_df.to_csv("hdb_clean_coords.csv", index=False)
    print(f"Success! Translated {len(clean_df)} carparks.")
    print("Saved as 'hdb_clean_coords.csv'.")

if __name__ == "__main__":
    generate_clean_hdb_coords()