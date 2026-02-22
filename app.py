from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from model_stub import analyze_posts
import os
from dotenv import load_dotenv
import time
import random
from geopy.geocoders import Nominatim
import json
import traceback
import praw

load_dotenv()

app = Flask(
    __name__,
    static_folder=os.path.join(os.path.dirname(__file__), 'static'),
    template_folder=os.path.join(os.path.dirname(__file__), 'templates')
)
CORS(app)

geolocator = Nominatim(user_agent="disaster_app")

# Geographic bounds for each region {region: (min_lat, max_lat, min_lon, max_lon)}
REGION_BOUNDS = {
    "india": (8, 35, 68, 97),
    "usa": (25, 49, -125, -67),
    "indonesia": (-11, 6, 95, 141),
    "australia": (-44, -10, 112, 154),
    "japan": (24, 46, 123, 146),
    "brazil": (-34, 5, -74, -32),
    "uk": (49, 61, -11, 2),
    "germany": (47, 55, 5, 15),
    "france": (41, 51, -5, 10),
    "italy": (36, 47, 6, 19),
    "spain": (36, 44, -10, 5),
    "canada": (42, 70, -141, -52),
    "china": (18, 54, 73, 135),
    "southafrica": (-35, -22, 16, 33),
    "mexico": (14, 33, -118, -86),
    "russia": (41, 82, 19, 180),
    "argentina": (-55, -21, -74, -53),
    "newzealand": (-47, -34, 166, 179),
    "singapore": (1.15, 1.47, 103.6, 104.1),
    "any": (-60, 70, -180, 180)
}

def random_latlon(region="any"):
    bounds = REGION_BOUNDS.get(region.lower(), REGION_BOUNDS["any"])
    min_lat, max_lat, min_lon, max_lon = bounds
    return round(random.uniform(min_lat, max_lat), 4), round(random.uniform(min_lon, max_lon), 4)

def get_lat_lon(place_name):
    try:
        if place_name:
            loc = geolocator.geocode(place_name)
            if loc:
                return loc.latitude, loc.longitude
    except:
        pass
    return None, None

@app.route("/")
def home():
    return render_template("index.html")
@app.route('/api/analyze', methods=['POST'])
def analyze():
    data = request.get_json(force=True)
    posts = data.get('posts', [])
    keyword = data.get('keyword', 'flood')
    region = data.get('region', 'any')
    real = data.get('real', False)
    try:
        if real:
            print("📥 Fetching live posts from Reddit...")
            live_posts = []
            
            reddit = praw.Reddit(
                client_id=os.getenv("REDDIT_CLIENT_ID"),
                client_secret=os.getenv("REDDIT_CLIENT_SECRET"),
                user_agent=os.getenv("REDDIT_USER_AGENT"),
                username=os.getenv("REDDIT_USERNAME"),
                password=os.getenv("REDDIT_PASSWORD"),
            )
            
            subreddit = reddit.subreddit("worldnews+news")
            
            # Build search query with keyword and region filter
            # Map region codes to full names for better search results
            region_names = {
                "india": "India",
                "usa": "USA OR United States OR America",
                "indonesia": "Indonesia",
                "australia": "Australia",
                "japan": "Japan",
                "brazil": "Brazil",
                "uk": "UK OR United Kingdom OR Britain",
                "germany": "Germany",
                "france": "France",
                "italy": "Italy",
                "spain": "Spain",
                "canada": "Canada",
                "china": "China",
                "southafrica": "South Africa",
                "mexico": "Mexico",
                "russia": "Russia",
                "argentina": "Argentina",
                "newzealand": "New Zealand",
                "singapore": "Singapore"
            }
            
            # Construct search query based on region
            if region.lower() != "any":
                region_query = region_names.get(region.lower(), region)
                search_query = f"{keyword} ({region_query})"
            else:
                search_query = keyword
            
            print(f"🔍 Search query: {search_query}")
            submissions = subreddit.search(search_query, limit=50, sort="new")

            for submission in submissions:
                text_content = f"{submission.title}. {submission.selftext}"
                live_posts.append({
                    "text": text_content,
                    "lat": None,
                    "lon": None,
                    "timestamp": int(submission.created_utc * 1000),
                })

            posts = live_posts
            print(f"📊 Found {len(posts)} Reddit posts to analyze.")
            if not posts:
                 return jsonify({'posts': [], 'score': 0, 'error': 'No Reddit posts found for this keyword.'}), 200

        for p in posts:
            if not p.get('lat') or not p.get('lon'):
                p['lat'], p['lon'] = random_latlon(region)
        
        result = analyze_posts(posts)
        out = {
            'posts': result['posts'],
            'score': result['score'],
            'neg': result['sentimentCounts']['neg'],
            'neu': result['sentimentCounts']['neu'],
            'pos': result['sentimentCounts']['pos'],
            'keywordFreq': result['keywordFreq'],
            'times': result['times']
        }
        return jsonify(out), 200
    except Exception as e:
        print(f"❌ Backend Error: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

if __name__ == "__main__":
    app.run(port=8000, debug=True)
