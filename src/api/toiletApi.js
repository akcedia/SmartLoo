import mockData from '../mocks/mockToilets.json';

// Read backend URL from environment variables, fallback to local server
const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export const fetchNearbyToilets = async (params) => {
  // Real API integration (will be enabled when Özgür finishes the backend API)
  /*
  const query = new URLSearchParams(params).toString();
  const response = await fetch(`${BASE_URL}/api/v1/toilets/nearby?${query}`);
  if (!response.ok) throw new Error('Server connection error');
  return await response.json();
  */

  // Temporary mock data promise (simulating 400ms network delay)
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(mockData);
    }, 400);
  });
};