import React, { useState, useEffect } from 'react';
import { Search, Clock, ChefHat, X, Heart, Filter, AlertCircle, Wifi, WifiOff } from 'lucide-react';

const RecipeFinder = () => {
  const [searchMode, setSearchMode] = useState('ingredient');
  const [searchQuery, setSearchQuery] = useState('');
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    // Check if storage API is available
    if (!window.storage) {
      console.log('Storage API not available, using memory only');
      setFavorites([]);
      return;
    }
    
    try {
      const result = await window.storage.get('recipe-favorites');
      if (result) {
        const loaded = JSON.parse(result.value);
        setFavorites(loaded);
        console.log('Favorites loaded:', loaded.length, 'recipes');
      } else {
        console.log('No favorites found in storage');
        setFavorites([]);
      }
    } catch (error) {
      console.log('Error loading favorites, starting fresh:', error);
      setFavorites([]);
    }
  };

  const saveFavorites = async (newFavorites) => {
    // First update state immediately for better UX
    setFavorites(newFavorites);
    
    // Check if storage API is available
    if (!window.storage) {
      console.log('Storage API not available - favorites will be lost on refresh');
      return;
    }
    
    try {
      const result = await window.storage.set('recipe-favorites', JSON.stringify(newFavorites));
      if (result) {
        console.log('Favorites saved successfully:', newFavorites.length, 'recipes');
      } else {
        console.warn('Storage returned null, but state updated');
      }
    } catch (error) {
      console.error('Failed to save to storage:', error);
      // Don't show alert since state is already updated
    }
  };

  const toggleFavorite = async (recipe) => {
    try {
      const isFav = favorites.some(fav => fav.idMeal === recipe.idMeal);
      let newFavorites;
      
      if (isFav) {
        newFavorites = favorites.filter(fav => fav.idMeal !== recipe.idMeal);
        console.log('Removing from favorites:', recipe.strMeal);
      } else {
        newFavorites = [...favorites, recipe];
        console.log('Adding to favorites:', recipe.strMeal);
      }
      
      await saveFavorites(newFavorites);
    } catch (error) {
      console.error('Error toggling favorite:', error);
      alert('Failed to update favorites. The change will work for this session only.');
    }
  };

  const searchRecipes = async () => {
    if (!searchQuery.trim() && searchMode !== 'favorites') {
      setError('Please enter a search term');
      return;
    }
    if (!navigator.onLine) {
      setError('You appear to be offline. Please check your internet connection.');
      return;
    }
    setLoading(true);
    setError('');
    setRecipes([]);

    try {
      if (searchMode === 'favorites') {
        setRecipes(favorites);
        setLoading(false);
        return;
      }

      let url = '';
      if (searchMode === 'ingredient') {
        url = `https://www.themealdb.com/api/json/v1/1/filter.php?i=${encodeURIComponent(searchQuery)}`;
      } else if (searchMode === 'name') {
        url = `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(searchQuery)}`;
      } else if (searchMode === 'category') {
        url = `https://www.themealdb.com/api/json/v1/1/filter.php?c=${encodeURIComponent(searchQuery)}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.meals && data.meals.length > 0) {
        setRecipes(data.meals);
      } else {
        setError(`No recipes found for "${searchQuery}". Try different ingredients or terms!`);
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('Request timed out. The API might be slow. Please try again.');
      } else if (err.message.includes('Failed to fetch')) {
        setError('Unable to connect to recipe database. Please check your connection and try again.');
      } else {
        setError(`Error: ${err.message}. Please try again.`);
      }
      if (favorites.length > 0) {
        setError(prev => prev + '\n\nYou can browse your saved favorites while offline!');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchRecipeDetails = async (idMeal) => {
    if (!navigator.onLine) {
      setError('You appear to be offline. Cannot load recipe details.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(
        `https://www.themealdb.com/api/json/v1/1/lookup.php?i=${idMeal}`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.meals && data.meals[0]) {
        setSelectedRecipe(data.meals[0]);
      } else {
        setError('Recipe details not found.');
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('Request timed out. Please try again.');
      } else {
        setError('Failed to load recipe details. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const getIngredients = (recipe) => {
    const ingredients = [];
    for (let i = 1; i <= 20; i++) {
      const ingredient = recipe[`strIngredient${i}`];
      const measure = recipe[`strMeasure${i}`];
      if (ingredient && ingredient.trim()) {
        ingredients.push(`${measure} ${ingredient}`);
      }
    }
    return ingredients;
  };

  const quickSearches = [
    { label: 'Chicken', value: 'chicken', icon: '🍗' },
    { label: 'Pasta', value: 'pasta', icon: '🍝' },
    { label: 'Beef', value: 'beef', icon: '🥩' },
    { label: 'Vegetarian', value: 'vegetarian', icon: '🥗' },
  ];

  const handleQuickSearch = (value) => {
    setSearchQuery(value);
    setSearchMode('ingredient');
    setError('');
    setTimeout(() => searchRecipes(), 100);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      searchRecipes();
    }
  };

  const isFavorite = (recipe) => {
    return favorites.some(fav => fav.idMeal === recipe.idMeal);
  };

  const testConnection = async () => {
    setLoading(true);
    setError('');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(
        'https://www.themealdb.com/api/json/v1/1/search.php?s=chicken',
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);
      if (response.ok) {
        const data = await response.json();
        if (data.meals) {
          setError('');
          alert('Connection successful! The API is working.');
        } else {
          alert('Connected but no data returned.');
        }
      } else {
        alert(`Connection failed with status: ${response.status}`);
      }
    } catch (err) {
      alert(`Connection test failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <style>{`
        .recipe-card { 
          background: white; 
          border-radius: 12px; 
          box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
          overflow: hidden; 
          cursor: pointer; 
          transition: all 0.3s;
        }
        .recipe-card:hover { 
          box-shadow: 0 8px 16px rgba(0,0,0,0.15); 
        }
        .recipe-card img { 
          transition: transform 0.3s; 
        }
        .recipe-card:hover img { 
          transform: scale(1.05); 
        }
        .search-input:focus { 
          border-color: #f97316; 
        }
        .search-button:hover:not(:disabled) { 
          background-color: #ea580c; 
        }
        .quick-button:hover:not(:disabled) { 
          background-color: #fde68a; 
        }
        .video-link:hover { 
          background-color: #b91c1c; 
        }
        .close-btn:hover { 
          background-color: #f3f4f6; 
        }
        .tab-btn:hover { 
          background-color: #e5e7eb; 
        }
        .tab-btn.active:hover { 
          background-color: #ea580c; 
        }
      `}</style>
      
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.headerLeft}>
            <ChefHat color="#f97316" size={32} />
            <h1 style={styles.title}>Recipe Finder</h1>
          </div>
          <div style={styles.headerRight}>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px', color: isOnline ? '#16a34a' : '#dc2626'}}>
              {isOnline ? <Wifi size={20} /> : <WifiOff size={20} />}
              <span style={{fontSize: '14px', fontWeight: '500'}}>{isOnline ? 'Online' : 'Offline'}</span>
            </div>
            <div style={{fontSize: '14px', color: '#4b5563'}}>Welcome, Taylor! 👋</div>
          </div>
        </div>
      </header>

      <main style={styles.main}>
        {!isOnline && (
          <div style={styles.offlineBanner}>
            <WifiOff color="#dc2626" size={24} />
            <div>
              <h3 style={{color: '#991b1b', fontWeight: '600', margin: '0 0 4px 0'}}>You're Offline</h3>
              <p style={{color: '#b91c1c', fontSize: '14px', margin: 0}}>
                You can browse favorites, but searching requires internet.
              </p>
            </div>
          </div>
        )}

        {!selectedRecipe && (
          <div style={styles.searchSection}>
            <h2 style={styles.searchTitle}>What would you like to cook today?</h2>
            
            <div style={styles.tabContainer}>
              {['ingredient', 'name', 'category', 'favorites'].map(mode => (
                <button
                  key={mode}
                  onClick={() => {
                    setSearchMode(mode);
                    if (mode === 'favorites') {
                      setRecipes(favorites);
                      setError('');
                    }
                  }}
                  className={`tab-btn ${searchMode === mode ? 'active' : ''}`}
                  style={{
                    ...styles.tab,
                    ...(searchMode === mode ? styles.tabActive : {})
                  }}
                >
                  {mode === 'favorites' ? `❤️ Favorites (${favorites.length})` : `By ${mode.charAt(0).toUpperCase() + mode.slice(1)}`}
                </button>
              ))}
            </div>

            {searchMode !== 'favorites' && (
              <>
                <div style={styles.searchInputContainer}>
                  <div style={styles.searchInputWrapper}>
                    <Search color="#9ca3af" size={20} style={styles.searchIcon} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder={`Enter ${searchMode}...`}
                      className="search-input"
                      style={styles.searchInput}
                    />
                  </div>
                  <button
                    onClick={searchRecipes}
                    disabled={loading || !isOnline}
                    className="search-button"
                    style={{...styles.searchButton, ...(loading || !isOnline ? styles.buttonDisabled : {})}}
                  >
                    {loading ? 'Searching...' : 'Search'}
                  </button>
                </div>

                {searchMode === 'ingredient' && (
                  <div style={{marginTop: '16px'}}>
                    <p style={{fontSize: '14px', color: '#4b5563', marginBottom: '8px'}}>Quick searches:</p>
                    <div style={{display: 'flex', flexWrap: 'wrap', gap: '8px'}}>
                      {quickSearches.map(item => (
                        <button
                          key={item.value}
                          onClick={() => handleQuickSearch(item.value)}
                          disabled={!isOnline}
                          className="quick-button"
                          style={{...styles.quickButton, ...(!isOnline ? styles.buttonDisabled : {})}}
                        >
                          {item.icon} {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{marginTop: '16px'}}>
                  <button
                    onClick={testConnection}
                    disabled={loading || !isOnline}
                    style={{fontSize: '14px', color: '#2563eb', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0}}
                  >
                    Test API Connection
                  </button>
                </div>
              </>
            )}

            {error && (
              <div style={styles.errorContainer}>
                <AlertCircle color="#dc2626" size={20} />
                <p style={{color: '#b91c1c', margin: 0, whiteSpace: 'pre-line'}}>{error}</p>
              </div>
            )}
          </div>
        )}

        {selectedRecipe && (
          <div style={styles.recipeModal}>
            <div style={{position: 'relative'}}>
              <img src={selectedRecipe.strMealThumb} alt={selectedRecipe.strMeal} style={styles.recipeImage} />
              <button onClick={() => setSelectedRecipe(null)} className="close-btn" style={styles.closeButton}>
                <X size={24} />
              </button>
              <button
                onClick={() => toggleFavorite(selectedRecipe)}
                style={{
                  ...styles.favoriteButton,
                  ...(isFavorite(selectedRecipe) ? {backgroundColor: '#ef4444', color: 'white'} : {})
                }}
              >
                <Heart size={24} fill={isFavorite(selectedRecipe) ? 'currentColor' : 'none'} />
              </button>
            </div>

            <div style={styles.recipeContent}>
              <h2 style={styles.recipeTitle}>{selectedRecipe.strMeal}</h2>
              <div style={{display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px'}}>
                {selectedRecipe.strCategory && (
                  <span style={{padding: '4px 12px', backgroundColor: '#fed7aa', color: '#9a3412', borderRadius: '16px', fontSize: '14px', fontWeight: '500'}}>
                    {selectedRecipe.strCategory}
                  </span>
                )}
                {selectedRecipe.strArea && (
                  <span style={{padding: '4px 12px', backgroundColor: '#bfdbfe', color: '#1e40af', borderRadius: '16px', fontSize: '14px', fontWeight: '500'}}>
                    {selectedRecipe.strArea}
                  </span>
                )}
              </div>

              <div style={styles.recipeDetails}>
                <div>
                  <h3 style={styles.sectionTitle}>Ingredients</h3>
                  <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
                    {getIngredients(selectedRecipe).map((ingredient, index) => (
                      <li key={index} style={{display: 'flex', marginBottom: '8px'}}>
                        <span style={{color: '#f97316', marginRight: '8px'}}>•</span>
                        <span>{ingredient}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 style={styles.sectionTitle}>Instructions</h3>
                  <div style={{color: '#374151', whiteSpace: 'pre-line', lineHeight: '1.6'}}>
                    {selectedRecipe.strInstructions}
                  </div>
                </div>
              </div>

              {selectedRecipe.strYoutube && (
                <div style={{marginTop: '24px'}}>
                  <a
                    href={selectedRecipe.strYoutube}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="video-link"
                    style={styles.videoButton}
                  >
                    🎥 Watch Video Tutorial
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {!selectedRecipe && recipes.length > 0 && (
          <div>
            <h3 style={{fontSize: '24px', fontWeight: '600', color: '#1f2937', marginBottom: '16px'}}>
              {searchMode === 'favorites' ? 'Your Favorite Recipes' : 'Found Recipes'} ({recipes.length})
            </h3>
            <div style={styles.recipeGrid}>
              {recipes.map(recipe => (
                <div key={recipe.idMeal} className="recipe-card">
                  <div style={{position: 'relative', overflow: 'hidden'}}>
                    <img
                      src={recipe.strMealThumb}
                      alt={recipe.strMeal}
                      style={{width: '100%', height: '192px', objectFit: 'cover', display: 'block'}}
                      onClick={() => fetchRecipeDetails(recipe.idMeal)}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(recipe);
                      }}
                      style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        padding: '8px',
                        borderRadius: '50%',
                        border: 'none',
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        ...(isFavorite(recipe) ? {backgroundColor: '#ef4444', color: 'white'} : {backgroundColor: 'white', color: '#374151'})
                      }}
                    >
                      <Heart size={20} fill={isFavorite(recipe) ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                  <div style={{padding: '16px', cursor: 'pointer'}} onClick={() => fetchRecipeDetails(recipe.idMeal)}>
                    <h4 style={{fontWeight: '600', color: '#1f2937', margin: '0 0 8px 0', lineHeight: '1.4'}}>
                      {recipe.strMeal}
                    </h4>
                    {recipe.strCategory && (
                      <span style={{fontSize: '12px', padding: '4px 8px', backgroundColor: '#fed7aa', color: '#9a3412', borderRadius: '12px'}}>
                        {recipe.strCategory}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && recipes.length === 0 && !error && !selectedRecipe && (
          <div style={{textAlign: 'center', padding: '64px 0'}}>
            <ChefHat color="#d1d5db" size={64} style={{margin: '0 auto 16px'}} />
            <h3 style={{fontSize: '20px', fontWeight: '600', color: '#4b5563', marginBottom: '8px'}}>
              {searchMode === 'favorites' ? 'No favorites yet' : 'Ready to find delicious recipes?'}
            </h3>
            <p style={{color: '#6b7280', margin: 0}}>
              {searchMode === 'favorites' ? 'Start adding recipes!' : 'Search to get started!'}
            </p>
          </div>
        )}
      </main>

      <footer style={styles.footer}>
        <div style={{maxWidth: '1280px', margin: '0 auto', padding: '0 16px', textAlign: 'center', color: '#4b5563', fontSize: '14px'}}>
          <p style={{margin: '0 0 8px 0'}}>Powered by TheMealDB API | Built for Taylor</p>
          <p style={{margin: 0, fontSize: '12px'}}>Having issues? Try "Test API Connection"</p>
        </div>
      </footer>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(to bottom right, #fff7ed, #fef3c7)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    backgroundColor: '#ffffff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  headerContent: {
    maxWidth: '1280px',
    margin: '0 auto',
    padding: '24px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '16px',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  title: {
    fontSize: '30px',
    fontWeight: 'bold',
    color: '#1f2937',
    margin: 0,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
  },
  main: {
    maxWidth: '1280px',
    margin: '0 auto',
    padding: '32px 16px',
  },
  offlineBanner: {
    backgroundColor: '#fef2f2',
    borderLeft: '4px solid #dc2626',
    padding: '16px',
    marginBottom: '24px',
    borderRadius: '0 8px 8px 0',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
  },
  searchSection: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    padding: '24px',
    marginBottom: '32px',
  },
  searchTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: '16px',
  },
  tabContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginBottom: '16px',
  },
  tab: {
    padding: '8px 16px',
    borderRadius: '8px',
    fontWeight: '500',
    border: 'none',
    cursor: 'pointer',
    backgroundColor: '#f3f4f6',
    color: '#374151',
    transition: 'all 0.2s',
  },
  tabActive: {
    backgroundColor: '#f97316',
    color: '#ffffff',
  },
  searchInputContainer: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
  },
  searchInputWrapper: {
    flex: 1,
    position: 'relative',
  },
  searchIcon: {
    position: 'absolute',
    left: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    pointerEvents: 'none',
  },
  searchInput: {
    width: '100%',
    padding: '12px 12px 12px 40px',
    border: '2px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '16px',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  },
  searchButton: {
    padding: '12px 24px',
    backgroundColor: '#f97316',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    fontSize: '16px',
  },
  buttonDisabled: {
    backgroundColor: '#d1d5db',
    cursor: 'not-allowed',
    opacity: 0.6,
  },
  quickButton: {
    padding: '8px 16px',
    backgroundColor: '#fef3c7',
    color: '#92400e',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'background-color 0.2s',
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    padding: '16px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    marginTop: '16px',
  },
  recipeModal: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    overflow: 'hidden',
    marginBottom: '32px',
  },
  recipeImage: {
    width: '100%',
    height: '256px',
    objectFit: 'cover',
    display: 'block',
  },
  closeButton: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    backgroundColor: '#ffffff',
    padding: '8px',
    borderRadius: '50%',
    border: 'none',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.2s',
  },
  favoriteButton: {
    position: 'absolute',
    top: '16px',
    left: '16px',
    padding: '8px',
    borderRadius: '50%',
    border: 'none',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    color: '#374151',
    transition: 'all 0.2s',
  },
  recipeContent: {
    padding: '24px',
  },
  recipeTitle: {
    fontSize: '30px',
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: '16px',
  },
  recipeDetails: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '24px',
  },
  sectionTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: '12px',
  },
  videoButton: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '12px 24px',
    backgroundColor: '#dc2626',
    color: '#ffffff',
    borderRadius: '8px',
    textDecoration: 'none',
    fontWeight: '500',
    transition: 'background-color 0.2s',
  },
  recipeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
    gap: '24px',
  },
  footer: {
    backgroundColor: '#ffffff',
    borderTop: '1px solid #e5e7eb',
    marginTop: '48px',
    padding: '24px 0',
  },
};

export default RecipeFinder;