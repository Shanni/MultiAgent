import dotenv from 'dotenv';

dotenv.config();

if (!process.env.CRYPTOPANIC_NEWS_API_KEY) {
  throw new Error('Missing CRYPTOPANIC_NEWS_API_KEY in environment variables.');
}

export interface CryptoNews {
  title: string;
  url: string;
  source: string;
  published_at: string;
}

export async function fetchCryptoNews(): Promise<CryptoNews[]> {
  try {
    const API_KEY = process.env.CRYPTOPANIC_NEWS_API_KEY;
    const response = await fetch(
      `https://cryptopanic.com/api/v1/posts/?auth_token=${API_KEY}&public=true`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.results.map((article: any) => ({
      title: article.title,
      url: article.url,
      source: article.source.title,
      published_at: article.published_at
    }));
  } catch (error) {
    console.error('Error fetching crypto news:', error);
    throw error;
  }
} 