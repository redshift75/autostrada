from flask import Flask, request, jsonify
import pickle
import numpy as np
import pandas as pd
import os
from supabase import create_client
import zipfile
import io
import tempfile
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_SERVICE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Global dictionary to store models and label encoders
models_cache = {}

def load_models_for_make(make):
    """Load models and label encoders for a specific make from zipped file."""
    try:
        bucket_name = "models"
        zip_file_path = f"{make}/model.zip"

        # Download zip file from Supabase
        zip_data = supabase.storage.from_(bucket_name).download(zip_file_path)
        
        # Create a BytesIO object to handle the zip data
        zip_buffer = io.BytesIO(zip_data)
        
        # Create a temporary directory to extract files
        with tempfile.TemporaryDirectory() as temp_dir:
            # Extract zip contents
            with zipfile.ZipFile(zip_buffer, 'r') as zip_ref:
                zip_ref.extractall(temp_dir)
            
            # Load the extracted files
            return {
                'model': pickle.load(open(os.path.join(temp_dir, 'model.pkl'), 'rb')),
                'labels_color': pickle.load(open(os.path.join(temp_dir, 'labels_color.pkl'), 'rb')),
                'labels_model': pickle.load(open(os.path.join(temp_dir, 'labels_model.pkl'), 'rb')),
                'labels_transmission': pickle.load(open(os.path.join(temp_dir, 'labels_transmission.pkl'), 'rb'))
            }
    except Exception as e:
        print(f"Error loading models for {make}: {e}")
        return None

@app.route('/models/predict', methods=['POST'])
def predict():
    try:
        # Get data from request
        data = request.get_json()
        make = data.get('make')
        
        # Extract features
        features = [
            make,
            data.get('model'),
            data.get('year'),
            data.get('mileage'),
            data.get('normalized_color'),
            data.get('transmission')
        ]
        
        # Check if all required features are present
        if any(feature is None for feature in features):
            return jsonify({"error": "Missing required features"}), 400

        # Load models if not already in cache
        if make not in models_cache:
            models_cache[make] = load_models_for_make(make)
            if models_cache[make] is None:
                return jsonify({"error": f"Failed to load models for make: {make}"}), 500

        # Get models from cache
        carmodel = models_cache[make]['model']
        labels_color = models_cache[make]['labels_color']
        labels_model = models_cache[make]['labels_model']
        labels_transmission = models_cache[make]['labels_transmission']

        # Create input data DataFrame
        input_data = pd.DataFrame({
            'year': [data.get('year')],
            'model': [data.get('model')],
            'mileage': [data.get('mileage')],
            'normalized_color': [data.get('normalized_color')],
            'transmission': [data.get('transmission')],
            'W': [1]
        })
        
        # Transform categorical variables
        input_data['model'] = labels_model.transform(input_data['model'])
        input_data['normalized_color'] = labels_color.transform(input_data['normalized_color'])
        input_data['transmission'] = labels_transmission.transform(input_data['transmission'])
        
        # Transform mileage using log1p
        input_data['mileage'] = np.log1p(input_data['mileage'])
        
        # Run prediction
        price_scaled = carmodel.predict(input_data)
        price = np.exp(price_scaled)
        
        return jsonify({
            "prediction": int(price[0]),
        })
            
    except Exception as e:
        return jsonify({"error": f"Error during prediction: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(port=5328)