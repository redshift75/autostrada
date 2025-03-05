import requests
from bs4 import BeautifulSoup
import csv
import os
from datetime import datetime

def scrape_bat_makes():
    # URL of the page to scrape
    url = "https://bringatrailer.com/models/"
    
    # Send a GET request to the URL
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    response = requests.get(url, headers=headers)
    
    # Check if the request was successful
    if response.status_code != 200:
        print(f"Failed to retrieve the page. Status code: {response.status_code}")
        return []
    
    # Parse the HTML content
    soup = BeautifulSoup(response.text, 'html.parser')
    
    # Find all make links based on the class provided
    make_links = soup.select('a.models-page-make-title-link')
    
    # Extract the make names
    makes = [link.text.strip() for link in make_links]
    
    return makes

def save_to_csv(makes, filename=None):
    # Generate filename with timestamp if not provided
    if filename is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"bat_makes_{timestamp}.csv"
    
    # Create 'data' directory if it doesn't exist
    os.makedirs('data', exist_ok=True)
    filepath = os.path.join('results', filename)
    
    # Write makes to CSV file
    with open(filepath, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.writer(csvfile)

        for i, make in enumerate(makes, 1):
            writer.writerow([make])
    
    return filepath

def main():
    makes = scrape_bat_makes()
    
    if makes:
        print(f"Found {len(makes)} car makes:")
        for i, make in enumerate(makes, 1):
            print(f"{make}")
        
        # Save to CSV
        csv_path = save_to_csv(makes)
        print(f"\nResults saved to: {csv_path}")
    else:
        print("No car makes found or there was an error.")

if __name__ == "__main__":
    main() 