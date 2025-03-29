from datetime import date
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import RandomForestRegressor
from dotenv import load_dotenv
from supabase import create_client
import os
import pickle

# Load environment variables
load_dotenv()

# Set pandas mode to copy on write
pd.options.mode.copy_on_write = True 

# Initialize Supabase client
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_SERVICE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def get_makes():
    """Fetch all makes from the all_makes table"""
    response = supabase.table("all_makes").select("make").execute()
    makes = [item['make'] for item in response.data]
    return makes

def fetch_data(make="Ferrari", min_observations=20):
    """Fetch data from Supabase and filter based on criteria"""
    response = (
        supabase.table("bat_completed_auctions")
        .select("year, model, mileage, normalized_color, transmission, sold_price, bid_amount, end_date, status")
        .eq("make", make)
        .not_.is_("mileage", None)
        .not_.is_("transmission", None)
        .execute()
    )
    df = pd.DataFrame(response.data)
    
    # Filter to models with more than min_observations
    counts = df['model'].value_counts()
    frequent_models = counts[counts >= min_observations].index
    df = df[df['model'].isin(frequent_models)]
    
    return df

def prepare_data(df):
    """Prepare data for model training"""

    # Replace sold_price with bid_amount and remove outliers
    df['sold_price'] = df['sold_price'].fillna(df['bid_amount'])
    df = df.dropna()

    # Remove outliers
    price_threshold = 1000000
    df.drop(df[df['sold_price'] >= price_threshold].index,inplace=True)

    # Log transform sold_price & mileage
    df['sold_price'] = np.log(df['sold_price'])
    df['mileage'] = np.log1p(df['mileage'])
    
    # Weight by recency
    df['days_since_end'] = (pd.to_datetime(date.today()) - pd.to_datetime(df["end_date"])).dt.days
    K = 1
    T = 360
    df['W'] = K * np.exp(-df['days_since_end']/T)
    
    # Prepare target and features
    y = df["sold_price"]
    X = df.drop(["sold_price", "bid_amount", "end_date", "status", "days_since_end"], axis=1)
    
    return X, y

def encode_features(X):
    """Encode categorical features"""
    Lbl_model = LabelEncoder()
    Lbl_color = LabelEncoder()
    Lbl_trans = LabelEncoder()
    
    X.model = Lbl_model.fit_transform(X.model)
    X.normalized_color = Lbl_color.fit_transform(X.normalized_color)
    X.transmission = Lbl_trans.fit_transform(X.transmission)
    
    return X, Lbl_model, Lbl_color, Lbl_trans

def train_model(X, y, make):
    """Train the Random Forest model"""
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.10, random_state=42, shuffle=True)
    
    car_model_rf = RandomForestRegressor(n_estimators=100, random_state=33, monotonic_cst=[0,0,-1,0,0,0])
    car_model_rf.fit(X_train, y_train, sample_weight=X_train['W'])
    
    print(f'Random Forest Regressor Train Score: {car_model_rf.score(X_train, y_train)}')
    print(f'Random Forest Regressor Test Score: {car_model_rf.score(X_test, y_test)}')
    
    return car_model_rf, X_test, y_test

def save_model(model, Lbl_model, Lbl_color, Lbl_trans, make):
    """Save the trained model and label encoders"""
    today_date = date.today().strftime('%Y-%m-%d')
    path = f"../models/{make}"
    if not os.path.exists(path):
        os.makedirs(path)
    
    pickle.dump(model, open(f'{path}/model.pkl', 'wb'))
    pickle.dump(Lbl_model, open(f'{path}/labels_model.pkl', 'wb'))
    pickle.dump(Lbl_color, open(f'{path}/labels_color.pkl', 'wb'))
    pickle.dump(Lbl_trans, open(f'{path}/labels_transmission.pkl', 'wb'))
    
    print(f"Model and encoders saved to {path}")

def main():
    # Get list of makes
    makes = get_makes()
    print(f"Found {len(makes)} makes to process")
    
    # Process each make
    for make in makes:
        print(f"\nProcessing {make}...")
        try:
            # Fetch and prepare data
            df = fetch_data(make)
            if len(df) < 20:  # Skip makes with too few observations
                print(f"Skipping {make} - insufficient data")
                continue
                
            X, y = prepare_data(df)
            X, Lbl_model, Lbl_color, Lbl_trans = encode_features(X)
            
            # Train model
            model, X_test, y_test = train_model(X, y, make)
            
            # Save model and encoders
            save_model(model, Lbl_model, Lbl_color, Lbl_trans, make)
            
        except Exception as e:
            print(f"Error processing {make}: {str(e)}")
            continue

if __name__ == "__main__":
    main() 