import axios, { AxiosResponse } from 'axios';
import { IPollingConfig } from '../../models/pollingConfig';

export interface DiscourseSearchPost {
  id: number;
  name: string;
  username: string;
  avatar_template: string;
  created_at: string;
  like_count: number;
  blurb: string;
  post_number: number;
  topic_title_headline: string;
  topic_id: number;
}

export interface DiscourseSearchResponse {
  posts: DiscourseSearchPost[];
}

export interface DiscourseDetailedPost {
  id: number;
  name: string;
  username: string;
  avatar_template: string;
  created_at: string;
  cooked: string;
  post_number: number;
  post_type: number;
  updated_at: string;
  reply_count: number;
  reply_to_post_number: number | null;
  quote_count: number;
  incoming_link_count: number;
  reads: number;
  readers_count: number;
  score: number;
  yours: boolean;
  topic_id: number;
  topic_slug: string;
}

export interface DiscoursePostDetailResponse {
  post_stream: {
    posts: DiscourseDetailedPost[];
  };
}

export class DiscourseClient {
  private baseUrl: string;
  private apiKey?: string;
  private apiUsername?: string;

  constructor(config: IPollingConfig) {
    this.baseUrl = config.instance_url;
    
    // Extract API credentials if provided
    if (config.api_config.auth?.type === 'api_key') {
      this.apiKey = config.api_config.auth.api_key_value;
      this.apiUsername = config.api_config.auth.username;
    }
  }

  /**
   * Step 1: Search for posts in a time range
   */
  async searchPostsInTimeRange(
    afterDate: Date, 
    beforeDate?: Date, 
    page: number = 1
  ): Promise<DiscourseSearchResponse> {
    const searchQuery = this.buildSearchQuery(afterDate, beforeDate);
    
    const params = new URLSearchParams({
      page: page.toString(),
      q: searchQuery
    });

    const url = `${this.baseUrl}/search.json?${params.toString()}`;
    
    try {
      const response = await this.makeRequest(url);
      return response.data as DiscourseSearchResponse;
    } catch (error) {
      console.error('Error searching Discourse posts:', error);
      throw error;
    }
  }

  /**
   * Step 2: Get detailed post content by post IDs
   */
  async getPostDetails(topicId: number, postIds: number[]): Promise<DiscoursePostDetailResponse> {
    // Build the URL with post_ids[] parameters
    const params = new URLSearchParams();
    postIds.forEach(postId => {
      params.append('post_ids[]', postId.toString());
    });

    const url = `${this.baseUrl}/t/${topicId}/posts.json?${params.toString()}`;
    
    try {
      const response = await this.makeRequest(url);
      return response.data as DiscoursePostDetailResponse;
    } catch (error) {
      console.error(`Error fetching post details for topic ${topicId}:`, error);
      throw error;
    }
  }

  /**
   * Complete workflow: Search posts and fetch their details
   */
  async fetchPostsWithDetails(
    afterDate: Date, 
    beforeDate?: Date, 
    maxPages: number = 5
  ): Promise<DiscourseDetailedPost[]> {
    const allDetailedPosts: DiscourseDetailedPost[] = [];
    
    // Step 1: Search for posts across multiple pages
    for (let page = 1; page <= maxPages; page++) {
      console.log(`Searching Discourse posts - page ${page}`);
      
      const searchResponse = await this.searchPostsInTimeRange(afterDate, beforeDate, page);
      
      if (!searchResponse.posts || searchResponse.posts.length === 0) {
        console.log(`No more posts found on page ${page}, stopping search`);
        break;
      }

      // Group posts by topic_id for efficient batch fetching
      const postsByTopic = this.groupPostsByTopic(searchResponse.posts);
      
      // Step 2: Fetch detailed content for each topic
      for (const [topicId, posts] of postsByTopic.entries()) {
        try {
          console.log(`Fetching details for ${posts.length} posts in topic ${topicId}`);
          
          const postIds = posts.map(post => post.id);
          const detailResponse = await this.getPostDetails(topicId, postIds);
          
          if (detailResponse.post_stream?.posts) {
            // Merge search metadata with detailed content
            const enrichedPosts = this.mergePostData(posts, detailResponse.post_stream.posts);
            allDetailedPosts.push(...enrichedPosts);
          }
          
          // Small delay between topic requests to be respectful
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (error) {
          console.error(`Failed to fetch details for topic ${topicId}:`, error);
          // Continue with other topics even if one fails
        }
      }
      
      // Delay between pages
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return allDetailedPosts;
  }

  /**
   * Build search query for Discourse API
   */
  private buildSearchQuery(afterDate: Date, beforeDate?: Date): string {
    const after = afterDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    let query = `after:${after}`;
    
    if (beforeDate) {
      const before = beforeDate.toISOString().split('T')[0];
      query += ` before:${before}`;
    }
    
    return query;
  }

  /**
   * Group posts by topic_id for batch fetching
   */
  private groupPostsByTopic(posts: DiscourseSearchPost[]): Map<number, DiscourseSearchPost[]> {
    const postsByTopic = new Map<number, DiscourseSearchPost[]>();
    
    for (const post of posts) {
      if (!postsByTopic.has(post.topic_id)) {
        postsByTopic.set(post.topic_id, []);
      }
      postsByTopic.get(post.topic_id)!.push(post);
    }
    
    return postsByTopic;
  }

  /**
   * Merge search results with detailed post content
   */
  private mergePostData(
    searchPosts: DiscourseSearchPost[], 
    detailedPosts: DiscourseDetailedPost[]
  ): DiscourseDetailedPost[] {
    const searchPostsMap = new Map(searchPosts.map(post => [post.id, post]));
    
    return detailedPosts.map(detailedPost => {
      const searchPost = searchPostsMap.get(detailedPost.id);
      
      // Merge additional data from search results
      return {
        ...detailedPost,
        // Add topic title from search results if available
        topic_title_headline: searchPost?.topic_title_headline || '',
        // Keep the detailed post's data as primary source
      };
    });
  }

  /**
   * Make authenticated request to Discourse API
   */
  private async makeRequest(url: string): Promise<AxiosResponse> {
    const headers: Record<string, string> = {
      'User-Agent': 'Enterpret-Feedback-Ingestion/1.0',
      'Accept': 'application/json'
    };

    // Add API authentication if available
    if (this.apiKey && this.apiUsername) {
      headers['Api-Key'] = this.apiKey;
      headers['Api-Username'] = this.apiUsername;
    }

    const response = await axios({
      method: 'GET',
      url,
      headers,
      timeout: 30000
    });

    return response;
  }

  /**
   * Get the latest post timestamp from a list of posts
   */
  getLatestTimestamp(posts: DiscourseDetailedPost[]): Date | null {
    if (posts.length === 0) return null;
    
    const timestamps = posts.map(post => new Date(post.updated_at || post.created_at));
    return new Date(Math.max(...timestamps.map(date => date.getTime())));
  }
} 