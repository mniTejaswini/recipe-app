from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import mysql.connector
from mysql.connector import Error
import os
from datetime import datetime
import json

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

# Database configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', ''),
    'database': os.getenv('DB_NAME', 'recipe_db')
}

# Default route — to confirm backend is running
@app.route('/')
def index():
    return "✅ Flask backend is running successfully!"

#  Optional health check route
@app.route('/api/health')
def health():
    return jsonify({"status": "ok", "message": "Backend working fine"})

# TheMealDB API base URL
MEALDB_BASE_URL = 'https://www.themealdb.com/api/json/v1/1'

# Database connection helper
def get_db_connection():
    """Create and return a database connection"""
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        return connection
    except Error as e:
        print(f"Error connecting to MySQL: {e}")
        return None

# Initialize database tables
def init_db():
    """Create necessary database tables if they don't exist"""
    connection = get_db_connection()
    if connection:
        try:
            cursor = connection.cursor()
            
            # Users table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(100) UNIQUE NOT NULL,
                    email VARCHAR(100) UNIQUE NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Favorites table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS favorites (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    meal_id VARCHAR(50) NOT NULL,
                    meal_name VARCHAR(255),
                    meal_thumb TEXT,
                    category VARCHAR(100),
                    area VARCHAR(100),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    UNIQUE KEY unique_favorite (user_id, meal_id)
                )
            """)
            
            # Search history table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS search_history (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    search_term VARCHAR(255) NOT NULL,
                    search_type VARCHAR(50) NOT NULL,
                    results_count INT DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            """)
            
            # Recipe cache table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS recipe_cache (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    meal_id VARCHAR(50) UNIQUE NOT NULL,
                    recipe_data JSON NOT NULL,
                    cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_meal_id (meal_id)
                )
            """)
            
            connection.commit()
            print("Database tables initialized successfully!")
            
        except Error as e:
            print(f"Error initializing database: {e}")
        finally:
            cursor.close()
            connection.close()

# API Routes

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/search/ingredient', methods=['GET'])
def search_by_ingredient():
    """Search recipes by ingredient"""
    ingredient = request.args.get('ingredient', '')
    user_id = request.args.get('user_id', 1)  # Default user
    
    if not ingredient:
        return jsonify({'error': 'Ingredient parameter is required'}), 400
    
    try:
        # Call TheMealDB API
        response = requests.get(f'{MEALDB_BASE_URL}/filter.php', params={'i': ingredient})
        data = response.json()
        
        # Log search history
        log_search_history(user_id, ingredient, 'ingredient', len(data.get('meals', [])))
        
        return jsonify(data)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/search/name', methods=['GET'])
def search_by_name():
    """Search recipes by name"""
    name = request.args.get('name', '')
    user_id = request.args.get('user_id', 1)
    
    if not name:
        return jsonify({'error': 'Name parameter is required'}), 400
    
    try:
        response = requests.get(f'{MEALDB_BASE_URL}/search.php', params={'s': name})
        data = response.json()
        
        log_search_history(user_id, name, 'name', len(data.get('meals', [])))
        
        return jsonify(data)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/search/category', methods=['GET'])
def search_by_category():
    """Search recipes by category"""
    category = request.args.get('category', '')
    user_id = request.args.get('user_id', 1)
    
    if not category:
        return jsonify({'error': 'Category parameter is required'}), 400
    
    try:
        response = requests.get(f'{MEALDB_BASE_URL}/filter.php', params={'c': category})
        data = response.json()
        
        log_search_history(user_id, category, 'category', len(data.get('meals', [])))
        
        return jsonify(data)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/recipe/<meal_id>', methods=['GET'])
def get_recipe_details(meal_id):
    """Get detailed recipe information by meal ID"""
    try:
        # Check cache first
        cached_recipe = get_cached_recipe(meal_id)
        if cached_recipe:
            return jsonify(cached_recipe)
        
        # Fetch from API if not cached
        response = requests.get(f'{MEALDB_BASE_URL}/lookup.php', params={'i': meal_id})
        data = response.json()
        
        # Cache the result
        if data.get('meals'):
            cache_recipe(meal_id, data)
        
        return jsonify(data)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/favorites', methods=['GET'])
def get_favorites():
    """Get user's favorite recipes"""
    user_id = request.args.get('user_id', 1)
    
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute("""
            SELECT meal_id, meal_name, meal_thumb, category, area, created_at
            FROM favorites
            WHERE user_id = %s
            ORDER BY created_at DESC
        """, (user_id,))
        
        favorites = cursor.fetchall()
        
        # Convert datetime to string for JSON serialization
        for fav in favorites:
            fav['created_at'] = fav['created_at'].isoformat()
        
        return jsonify({'favorites': favorites})
    
    except Error as e:
        return jsonify({'error': str(e)}), 500
    finally:
        cursor.close()
        connection.close()

@app.route('/api/favorites', methods=['POST'])
def add_favorite():
    """Add a recipe to favorites"""
    data = request.json
    user_id = data.get('user_id', 1)
    meal_id = data.get('meal_id')
    meal_name = data.get('meal_name')
    meal_thumb = data.get('meal_thumb')
    category = data.get('category')
    area = data.get('area')
    
    if not meal_id:
        return jsonify({'error': 'meal_id is required'}), 400
    
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cursor = connection.cursor()
        cursor.execute("""
            INSERT INTO favorites (user_id, meal_id, meal_name, meal_thumb, category, area)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE meal_name = VALUES(meal_name)
        """, (user_id, meal_id, meal_name, meal_thumb, category, area))
        
        connection.commit()
        return jsonify({'message': 'Added to favorites', 'meal_id': meal_id})
    
    except Error as e:
        return jsonify({'error': str(e)}), 500
    finally:
        cursor.close()
        connection.close()

@app.route('/api/favorites/<meal_id>', methods=['DELETE'])
def remove_favorite(meal_id):
    """Remove a recipe from favorites"""
    user_id = request.args.get('user_id', 1)
    
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cursor = connection.cursor()
        cursor.execute("""
            DELETE FROM favorites
            WHERE user_id = %s AND meal_id = %s
        """, (user_id, meal_id))
        
        connection.commit()
        return jsonify({'message': 'Removed from favorites', 'meal_id': meal_id})
    
    except Error as e:
        return jsonify({'error': str(e)}), 500
    finally:
        cursor.close()
        connection.close()

@app.route('/api/history', methods=['GET'])
def get_search_history():
    """Get user's search history"""
    user_id = request.args.get('user_id', 1)
    limit = request.args.get('limit', 10)
    
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute("""
            SELECT search_term, search_type, results_count, created_at
            FROM search_history
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT %s
        """, (user_id, limit))
        
        history = cursor.fetchall()
        
        for item in history:
            item['created_at'] = item['created_at'].isoformat()
        
        return jsonify({'history': history})
    
    except Error as e:
        return jsonify({'error': str(e)}), 500
    finally:
        cursor.close()
        connection.close()

@app.route('/api/categories', methods=['GET'])
def get_categories():
    """Get all available recipe categories"""
    try:
        response = requests.get(f'{MEALDB_BASE_URL}/categories.php')
        data = response.json()
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Helper functions

def log_search_history(user_id, search_term, search_type, results_count):
    """Log search history to database"""
    connection = get_db_connection()
    if connection:
        try:
            cursor = connection.cursor()
            cursor.execute("""
                INSERT INTO search_history (user_id, search_term, search_type, results_count)
                VALUES (%s, %s, %s, %s)
            """, (user_id, search_term, search_type, results_count))
            connection.commit()
        except Error as e:
            print(f"Error logging search history: {e}")
        finally:
            cursor.close()
            connection.close()

def get_cached_recipe(meal_id):
    """Get recipe from cache if available"""
    connection = get_db_connection()
    if connection:
        try:
            cursor = connection.cursor(dictionary=True)
            cursor.execute("""
                SELECT recipe_data FROM recipe_cache
                WHERE meal_id = %s AND cached_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
            """, (meal_id,))
            
            result = cursor.fetchone()
            if result:
                return json.loads(result['recipe_data'])
        except Error as e:
            print(f"Error getting cached recipe: {e}")
        finally:
            cursor.close()
            connection.close()
    return None

def cache_recipe(meal_id, recipe_data):
    """Cache recipe data"""
    connection = get_db_connection()
    if connection:
        try:
            cursor = connection.cursor()
            cursor.execute("""
                INSERT INTO recipe_cache (meal_id, recipe_data)
                VALUES (%s, %s)
                ON DUPLICATE KEY UPDATE recipe_data = VALUES(recipe_data), cached_at = NOW()
            """, (meal_id, json.dumps(recipe_data)))
            connection.commit()
        except Error as e:
            print(f"Error caching recipe: {e}")
        finally:
            cursor.close()
            connection.close()

# Initialize database on startup
if __name__ == '__main__':
    init_db()
    app.run(debug=True, host='0.0.0.0', port=5000)