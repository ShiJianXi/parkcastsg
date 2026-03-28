# parkcastsg

# 🛰️ Data Ingestion Pipeline

This module handles the automated polling, cleaning, and spatial mapping of Singapore's carpark and weather data. It is designed to run as a scheduled task (e.g., AWS Lambda) every 5 minutes.

## 🏗️ Architecture Overview
* **Live Polling:** Fetches data from LTA DataMall (Commercial/URA), Data.gov.sg (HDB), and NEA (2-Hour Forecast).
* **Coordinate Transformation:** Translates HDB SVY21 (X, Y) coordinates into global WGS84 (Lat, Lng) standards.
* **Spatial Mapping:** Uses the **Haversine Formula** to map every carpark to its geographically nearest weather station.
* **Data Sink:** Normalizes the unified dataset and "upserts" it into the PostgreSQL RDS instance for the FastAPI backend to consume.