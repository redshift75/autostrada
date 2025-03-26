from flask import Flask, request, jsonify
import pickle
import numpy as np
import pandas as pd
import os
from supabase import create_client
app = Flask(__name__)
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_SERVICE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

@app.route('/models/predict', methods=['POST'])
def predict():

    try:
        # Get data from request
        data = request.get_json()
        
        # Extract features
        features = [
            data.get('make'),
            data.get('model'),
            data.get('year'),
            data.get('mileage'),
            data.get('normalized_color'),
            data.get('transmission')
        ]
        
        # Check if all required features are present
        if any(feature is None for feature in features):
            return jsonify({"error": "Missing required features"}), 400

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
    # Download the model from the bucket
    try:
        bucket_name = "models"
        model_file_path = f"{data.get('make')}/model.pkl"
        labels_color_file_path = f"{data.get('make')}/labels_color.pkl"
        labels_model_file_path = f"{data.get('make')}/labels_model.pkl"
        labels_transmission_file_path = f"{data.get('make')}/labels_transmission.pkl"

        carmodel = pickle.loads(supabase.storage.from_(bucket_name).download(model_file_path))
        labels_color = pickle.loads(supabase.storage.from_(bucket_name).download(labels_color_file_path))
        labels_model = pickle.loads(supabase.storage.from_(bucket_name).download(labels_model_file_path))
        labels_transmission = pickle.loads(supabase.storage.from_(bucket_name).download(labels_transmission_file_path))

    except Exception as e:
        return jsonify({"error": f"Error downloading file: {e}"}), 500

    if carmodel is None:
        return jsonify({"error": "Model not loaded"}), 500
    else:
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
        try:
            input_data['model'] = labels_model.transform(input_data['model'])
            input_data['normalized_color'] = labels_color.transform(input_data['normalized_color'])
            input_data['transmission'] = labels_transmission.transform(input_data['transmission'])
            
            # Transform mileage using log1p
            input_data['mileage'] = np.log1p(input_data['mileage'])
            
            print("Transformed input data:")
            print(input_data)
            
            # Run prediction
            price_scaled = carmodel.predict(input_data)
            price = np.exp(price_scaled)
            
            return jsonify({
                "prediction": int(price[0]),
                }
            )
            
        except Exception as e:
            return jsonify({"error": f"Error during feature transformation: {str(e)}"}), 400

if __name__ == '__main__':
    app.run(port=5328)