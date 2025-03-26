from flask import Flask, request, jsonify
import joblib
import numpy as np
import pandas as pd

app = Flask(__name__)

# Load the model
try:
    carmodel = joblib.load('model_Porsche_2025-03-26.joblib')
    labels_model = joblib.load('labels_Porsche_model.joblib')
    labels_color = joblib.load('labels_Porsche_color.joblib')
    labels_transmission = joblib.load('labels_Porsche_transmission.joblib')
except Exception as e:
    print(f"Error loading model: {e}")
    carmodel = None

@app.route('/models/predict', methods=['POST'])
def predict():
    if carmodel is None:
        return jsonify({"error": "Model not loaded"}), 500

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
                "prediction": float(price[0]),
                "features": {
                    "make": features[0],
                    "model": features[1],
                    "year": features[2],
                    "mileage": features[3],
                    "normalized_color": features[4],
                    "transmission": features[5]
                }
            })
            
        except Exception as e:
            print(f"Error during transformation: {str(e)}")
            return jsonify({"error": f"Error during feature transformation: {str(e)}"}), 400
        
    except Exception as e:
        print(f"Error in predict endpoint: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(port=5328)